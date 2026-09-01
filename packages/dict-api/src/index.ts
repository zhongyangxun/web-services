import { eq } from 'drizzle-orm'
import { Hono } from 'hono'

import {
  asCacheHit,
  buildCacheKey,
  checkRateLimit,
  createBrowserExtCorsMiddleware,
  createRequestSignatureMiddleware,
  createTimingMarkMiddleware,
  createTimingMiddleware,
  DEFAULT_ALLOWED_HEADERS,
  markTiming,
  matchEdgeCache,
  parseExtensionOrigins,
  putEdgeCache,
  RateLimiterDurableObject,
  SECONDS,
  TimingVariables,
} from '@web-services/shared'

import { createDB, DB } from './db'
import { words } from './db/schema'

type Bindings = {
  ecdict_db: D1Database
  rate_limiter: DurableObjectNamespace<RateLimiterDurableObject>
}

type Variables = {
  db: DB
} & TimingVariables

type LookupBody = {
  lookup_key: string
}

const LOOKUP_URL = '/lookup'

const isValidLookupBody = (body: unknown): body is LookupBody => {
  return (
    typeof body === 'object' &&
    body !== null &&
    'lookup_key' in body &&
    typeof body.lookup_key === 'string' &&
    body.lookup_key.trim() !== '' &&
    body.lookup_key.trim().length <= 100
  )
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ message: 'Internal Server Error' }, 500)
})

app.use(
  '*',
  createBrowserExtCorsMiddleware({
    allowedOrigins: parseExtensionOrigins(process.env.ALLOWED_EXTENSION_IDS),
    allowHeaders: [...DEFAULT_ALLOWED_HEADERS, 'X-Signature', 'X-Timestamp'],
  }),
)

app.use(LOOKUP_URL, createTimingMiddleware())

app.use(
  LOOKUP_URL,
  createRequestSignatureMiddleware(process.env.REQUEST_SIGNATURE_SECRET!),
)
app.use(LOOKUP_URL, createTimingMarkMiddleware('after-signature'))

app.use(LOOKUP_URL, async (c, next) => {
  c.set('db', createDB(c.env.ecdict_db))
  await next()
})
app.use(LOOKUP_URL, createTimingMarkMiddleware('after-d1-init'))

app.post(LOOKUP_URL, async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ message: 'Invalid JSON' }, 400)
  }

  if (!isValidLookupBody(body)) {
    return c.json({ message: 'Invalid request body' }, 400)
  }

  const word = body.lookup_key.trim()

  const cacheKey = buildCacheKey({
    requestUrl: c.req.url,
    namespace: 'lookup',
    version: 'v1',
    parts: [word],
  })

  const cached = await matchEdgeCache(cacheKey)
  if (cached) {
    markTiming(c, 'cache-hit')
    return asCacheHit(cached)
  }
  markTiming(c, 'cache-miss')

  const rateLimitBlocked = await checkRateLimit(c, {
    bindingName: 'rate_limiter',
    serviceName: 'dict-api',
    routeName: LOOKUP_URL,
    ipMaxRequests: 150,
  })
  markTiming(c, 'after-ratelimit')
  if (rateLimitBlocked) {
    return rateLimitBlocked
  }

  const db = c.get('db')

  markTiming(c, 'before-d1-query')
  const result = await db.select().from(words).where(eq(words.word, word)).get()
  markTiming(c, 'after-d1-query')

  if (!result) {
    return c.json({ message: 'Word not found' }, 404)
  }

  const res = c.json({
    word: result.word,
    phonetic: result.phonetic,
    translation: result.translation,
    exchange: result.exchange,
  })

  await putEdgeCache(c.executionCtx, cacheKey, res, {
    maxAgeSeconds: SECONDS.DAY * 30,
    shouldCache: (res) => res.status === 200,
  })

  return res
})

app.get('/health', (c) => {
  return c.json({ message: 'ok' })
})

export default app

// Wrangler 要求导出 DO 类, 且与 `wrangler.jsonc` 里 `durable_objects.bindings[].class_name` 一致
export { RateLimiterDurableObject }

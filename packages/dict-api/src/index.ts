import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { eq } from 'drizzle-orm'
import { words } from './db/schema'
import { createDB, DB } from './db'

type Bindings = {
  ecdict_db: D1Database
}

type Variables = {
  db: DB
}

type LookupBody = {
  lookup_key: string
}

// 限流相关变量
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const CLEANUP_INTERVAL = 5 * 60 * 1000 // 每 5 分钟最多清理一次
let lastCleanupTime = 0

const LOOKUP_URL = '/lookup'

const isValidLookupBody = (body: unknown): body is LookupBody => {
  return (
    typeof body === 'object' &&
    body !== null &&
    'lookup_key' in body &&
    typeof body.lookup_key === 'string' &&
    body.lookup_key.trim() !== ''
  )
}

const cleanupRateLimitMap = () => {
  const now = Date.now()

  if (now - lastCleanupTime < CLEANUP_INTERVAL) {
    return
  }

  for (const [key, value] of rateLimitMap.entries()) {
    if (value.resetTime < now) {
      rateLimitMap.delete(key)
    }
  }

  lastCleanupTime = now
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ message: 'Internal Server Error' }, 500)
})

app.use(
  '*',
  cors({
    origin: ['chrome-extension://pfdbmcicifljojjkpfgafkdkcpdoamkl'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'X-Client-Id'],
    maxAge: 60 * 60 * 24,
  }),
)

// 限流中间件
// TODO: replace in-memory rate limiting with Durable Object (global + consistent)
app.use(LOOKUP_URL, async (c, next) => {
  const clientId = c.req.header('X-Client-Id')
  if (!clientId) {
    return c.json({ message: 'X-Client-Id is required' }, 400)
  }

  const ip = c.req.header('CF-Connecting-IP') || 'anonymous'
  const now = Date.now()
  const windowMs = 60 * 1000
  const maxRequests = 60
  const rateKey = `${ip}-${clientId}`

  let record = rateLimitMap.get(rateKey)

  if (!record || now > record.resetTime) {
    record = { count: 1, resetTime: now + windowMs }
  } else {
    record.count++
  }

  rateLimitMap.set(rateKey, record)

  // 清理过期的限流记录
  cleanupRateLimitMap()

  if (record.count > maxRequests) {
    return c.json(
      { message: 'Too many requests, please try again later.' },
      429,
    )
  }

  await next()
})

app.use(LOOKUP_URL, async (c, next) => {
  c.set('db', createDB(c.env.ecdict_db))
  await next()
})

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
  const db = c.get('db')
  const result = await db.select().from(words).where(eq(words.word, word)).get()

  if (!result) {
    return c.json({ message: 'Word not found' }, 404)
  }

  return c.json({
    word: result.word,
    phonetic: result.phonetic,
    translation: result.translation,
    exchange: result.exchange,
  })
})

app.get('/health', (c) => {
  return c.json({ message: 'ok' })
})

export default app

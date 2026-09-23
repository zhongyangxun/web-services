import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import * as z from 'zod'

import {
  asCacheHit,
  buildCacheKey,
  checkDailyQuota,
  checkRateLimit,
  CostGuardDurableObject,
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
  rollbackDailyQuota,
  SECONDS,
  TimingVariables,
} from '@web-services/shared'

import { hashText } from './hash-text'
import { NoTranslationError, youdaoTranslate } from './services/youdao'

type Bindings = {
  rate_limiter: DurableObjectNamespace<RateLimiterDurableObject>
  cost_guard: DurableObjectNamespace<CostGuardDurableObject>
}

const translateSchema = z
  .object({
    text: z.string().min(1).max(600),
  })
  .strict()

const TRANSLATE_SERVICE_NAME = 'translate-gateway'
const TRANSLATE_URL = '/translate'

const app = new Hono<{
  Bindings: Bindings
  Variables: TimingVariables
}>()

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

app.use(TRANSLATE_URL, createTimingMiddleware())

app.use(
  TRANSLATE_URL,
  createRequestSignatureMiddleware(process.env.REQUEST_SIGNATURE_SECRET!),
)
app.use(TRANSLATE_URL, createTimingMarkMiddleware('after-signature'))

app.post(
  TRANSLATE_URL,
  zValidator('json', translateSchema, (result, c) => {
    if (!result.success) {
      return c.json({ message: 'Invalid JSON' }, 400)
    }
  }),
  async (c) => {
    const { text } = c.req.valid('json')

    const cacheKey = buildCacheKey({
      requestUrl: c.req.url,
      namespace: 'translate',
      version: 'v1',
      // *use hash to limit length, since text could be too long
      parts: [await hashText(text)],
    })

    const cached = await matchEdgeCache(cacheKey)
    if (cached) {
      markTiming(c, 'cache-hit')
      return asCacheHit(cached)
    }
    markTiming(c, 'cache-miss')

    const checkRateLimitWithTiming = checkRateLimit(c, {
      bindingName: 'rate_limiter',
      serviceName: TRANSLATE_SERVICE_NAME,
      routeName: TRANSLATE_URL,
      ipMaxRequests: 90,
    }).then((res) => {
      markTiming(c, 'after-ratelimit')
      return res
    })

    // after cache miss and JSON validation, avoiding counting invalid requests and cache hit situation
    const checkDailyQuotaWithTiming = checkDailyQuota(c, {
      bindingName: 'cost_guard',
      serviceName: TRANSLATE_SERVICE_NAME,
      routeName: TRANSLATE_URL,
      maxPerDayEnvKey: 'DAILY_TRANSLATE_QUOTA',
    }).then((res) => {
      markTiming(c, 'after-quota')
      return res
    })

    // parallelize checkRateLimit and checkDailyQuota to reduce latency
    const [rateLimitBlocked, quotaBlocked] = await Promise.all([
      checkRateLimitWithTiming,
      checkDailyQuotaWithTiming,
    ])

    if (rateLimitBlocked) {
      if (!quotaBlocked) {
        // rollback daily quota if rate limit blocked but daily quota is not blocked
        c.executionCtx.waitUntil(
          rollbackDailyQuota<Bindings>({
            bindingName: 'cost_guard',
            serviceName: TRANSLATE_SERVICE_NAME,
            routeName: TRANSLATE_URL,
            context: c,
          }),
        )
      }

      return rateLimitBlocked
    }

    if (quotaBlocked) {
      return quotaBlocked
    }

    try {
      const result = await youdaoTranslate(text, {
        markTiming: (label) => markTiming(c, label),
      })

      markTiming(c, 'after-youdao')

      const res = c.json(result)

      await putEdgeCache(c.executionCtx, cacheKey, res, {
        maxAgeSeconds: SECONDS.DAY * 3,
        shouldCache: (res) => res.status === 200,
      })

      return res
    } catch (err) {
      if (err instanceof NoTranslationError) {
        // 无有效翻译结果，此处无需回滚每日请求限额，因为已经成功调用 Youdao API
        return c.json({ message: err.message }, 422)
      }

      // 发生错误时，回滚每日请求限额
      await rollbackDailyQuota<Bindings>({
        bindingName: 'cost_guard',
        serviceName: TRANSLATE_SERVICE_NAME,
        routeName: TRANSLATE_URL,
        context: c,
      })
      throw err
    }
  },
)

app.get('/health', (c) => c.json({ status: 'ok' }))

export default app

// Wrangler 要求导出 DO 类, 且与 `wrangler.jsonc` 里 `durable_objects.bindings[].class_name` 一致
export { CostGuardDurableObject, RateLimiterDurableObject }

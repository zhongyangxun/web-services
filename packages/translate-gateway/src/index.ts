import { Hono } from 'hono'
import * as z from 'zod'
import { NoTranslationError, youdaoTranslate } from './services/youdao'
import {
  createDurableObjectRateLimitMiddleware,
  RateLimiterDurableObject,
  createBrowserExtCorsMiddleware,
  parseExtensionOrigins,
  createRequestSignatureMiddleware,
  DEFAULT_ALLOWED_HEADERS,
  CostGuardDurableObject,
  createDailyQuotaMiddleware,
  rollbackDailyQuota,
} from '@web-services/shared'
import { zValidator } from '@hono/zod-validator'

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

app.use(
  TRANSLATE_URL,
  createRequestSignatureMiddleware(process.env.REQUEST_SIGNATURE_SECRET!),
)

app.use(
  TRANSLATE_URL,
  createDurableObjectRateLimitMiddleware<Bindings>({
    bindingName: 'rate_limiter',
    serviceName: TRANSLATE_SERVICE_NAME,
    routeName: TRANSLATE_URL,
    ipMaxRequests: 90,
  }),
)

app.post(
  TRANSLATE_URL,
  zValidator('json', translateSchema, (result, c) => {
    if (!result.success) {
      return c.json({ message: 'Invalid JSON' }, 400)
    }
  }),
  // 每日请求限额，只对合法请求计数，所以放在其它校验之后，避免计入非法请求
  createDailyQuotaMiddleware<Bindings>({
    bindingName: 'cost_guard',
    serviceName: TRANSLATE_SERVICE_NAME,
    routeName: TRANSLATE_URL,
    maxPerDayEnvKey: 'DAILY_TRANSLATE_QUOTA',
  }),
  async (c) => {
    const { text } = c.req.valid('json')

    try {
      const result = await youdaoTranslate(text)

      return c.json(result)
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
export { RateLimiterDurableObject, CostGuardDurableObject }

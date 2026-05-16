import { Hono } from 'hono'
import * as z from 'zod'
import { zValidator } from '@hono/zod-validator'
import { youdaoTranslate } from './services/youdao'
import { youdaoMockTranslate } from './services/youdao-mock'
import {
  createDurableObjectRateLimitMiddleware,
  RateLimiterDurableObject,
} from '@web-services/shared'

type Bindings = {
  rate_limiter: DurableObjectNamespace<RateLimiterDurableObject>
}

const translateSchema = z
  .object({
    text: z.string().min(1).max(600),
  })
  .strict()

const app = new Hono<{ Bindings: Bindings }>()

const TRANSLATE_URL = '/translate'

app.use(
  TRANSLATE_URL,
  createDurableObjectRateLimitMiddleware<Bindings>({
    bindingName: 'rate_limiter',
    serviceName: 'translate-gateway',
    routeName: TRANSLATE_URL,
  }),
)

app.post(
  TRANSLATE_URL,
  zValidator('json', translateSchema, (result, c) => {
    if (!result.success) {
      return c.json({ message: 'Invalid JSON' }, 400)
    }
  }),
  async (c) => {
    const { text } = c.req.valid('json')

    const result =
      process.env.NODE_ENV === 'production'
        ? await youdaoTranslate(text)
        : youdaoMockTranslate(text)

    return c.json(result)
  },
)

app.get('/health', (c) => c.json({ status: 'ok' }))

export default app

// Wrangler 要求导出 DO 类, 且与 `wrangler.jsonc` 里 `durable_objects.bindings[].class_name` 一致
export { RateLimiterDurableObject }

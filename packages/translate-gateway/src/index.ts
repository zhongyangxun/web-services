import { Hono } from 'hono'
import * as z from 'zod'
import { zValidator } from '@hono/zod-validator'
import { NoTranslationError, youdaoTranslate } from './services/youdao'
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

const TRANSLATE_URL = '/translate'

const shouldMockTranslate = (): boolean => {
  return (
    process.env.USE_MOCK_TRANSLATE === '1' ||
    process.env.USE_MOCK_TRANSLATE === 'true'
  )
}

const app = new Hono<{ Bindings: Bindings }>()

app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ message: 'Internal Server Error' }, 500)
})

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

    try {
      const result = shouldMockTranslate()
        ? youdaoMockTranslate(text)
        : await youdaoTranslate(text)

      return c.json(result)
    } catch (err) {
      if (err instanceof NoTranslationError) {
        return c.json({ message: err.message }, 422)
      }
      throw err
    }
  },
)

app.get('/health', (c) => c.json({ status: 'ok' }))

export default app

// Wrangler 要求导出 DO 类, 且与 `wrangler.jsonc` 里 `durable_objects.bindings[].class_name` 一致
export { RateLimiterDurableObject }

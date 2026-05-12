import { Hono } from 'hono'
import * as z from 'zod'
import { zValidator } from '@hono/zod-validator'
import { youdaoTranslate } from './services/youdao'
import { youdaoMockTranslate } from './services/youdao-mock'

const translateSchema = z
  .object({
    text: z.string().min(1).max(600),
  })
  .strict()

const app = new Hono()

app.post(
  '/translate',
  zValidator('json', translateSchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: 'Invalid JSON' }, 400)
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

import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

app.use('*', cors())

app.get('/lookup/:word', (c) => {
  const word = c.req.param('word')
  return c.json({ word, message: 'not implemented yet' })
})

app.get('/health', (c) => {
  return c.json({ message: 'ok' })
})

export default app

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

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ message: 'Internal Server Error' }, 500)
})

app.use('*', cors())

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

import { sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const words = sqliteTable('words', {
  word: text('word').primaryKey().notNull(),
  phonetic: text('phonetic'),
  translation: text('translation'),
  exchange: text('exchange'),
})

import Database from 'better-sqlite3'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const BATCH_SIZE = 10_000
const DEFAULT_DB_PATH = resolve(__dirname, '../../../../ECDICT/ecdict.db')

function escapeSQL(value: string | null | undefined): string {
  if (value == null || value === '') return 'NULL'
  return `'${value.replace(/'/g, "''")}'`
}

function main() {
  const dbPath = resolve(process.argv[2] ?? DEFAULT_DB_PATH)
  const outputDir = join(__dirname, 'sql')

  if (!existsSync(dbPath)) {
    console.error(`ECDICT database not found: ${dbPath}`)
    console.error(
      'Usage: pnpm tsx scripts/import-ecdict.ts [path-to-ecdict.db]',
    )
    process.exit(1)
  }

  mkdirSync(outputDir, { recursive: true })

  const db = new Database(dbPath, { readonly: true })
  const { total } = db
    .prepare('SELECT COUNT(*) AS total FROM stardict')
    .get() as { total: number }
  console.log(`Source: ${dbPath}`)
  console.log(`Total rows: ${total.toLocaleString()}`)

  const stmt = db.prepare(
    'SELECT word, phonetic, translation, exchange FROM stardict ORDER BY id',
  )

  let batchIndex = 0
  let buffer: string[] = []
  let written = 0

  for (const row of stmt.iterate() as Iterable<Record<string, string | null>>) {
    buffer.push(
      `INSERT OR IGNORE INTO words (word, phonetic, translation, exchange) VALUES (${escapeSQL(row.word)}, ${escapeSQL(row.phonetic)}, ${escapeSQL(row.translation)}, ${escapeSQL(row.exchange)});`,
    )

    if (buffer.length >= BATCH_SIZE) {
      writeBatch(outputDir, batchIndex, buffer)
      written += buffer.length
      batchIndex++
      buffer = []
      process.stdout.write(
        `\r  Progress: ${written.toLocaleString()} / ${total.toLocaleString()}`,
      )
    }
  }

  if (buffer.length > 0) {
    writeBatch(outputDir, batchIndex, buffer)
    written += buffer.length
    batchIndex++
  }

  db.close()

  console.log(
    `\n\nDone! Generated ${batchIndex} batch files (${written.toLocaleString()} rows)`,
  )
  console.log(`Output: ${outputDir}\n`)
  console.log('Next steps — import into D1:')
  console.log('  # 1. Create the D1 database (once)')
  console.log('  wrangler d1 create ecdict-db\n')
  console.log('  # 2. Apply schema')
  console.log(
    '  wrangler d1 execute ecdict-db --file=scripts/schema.sql --remote\n',
  )
  console.log('  # 3. Import all batches')
  console.log(`  for f in scripts/sql/batch_*.sql; do`)
  console.log(`    echo "Importing $f ..."`)
  console.log(`    wrangler d1 execute ecdict-db --file="$f" --remote`)
  console.log(`  done`)
}

function writeBatch(dir: string, index: number, rows: string[]) {
  const name = `batch_${String(index).padStart(3, '0')}.sql`
  const content = rows.join('\n') + '\n'
  writeFileSync(join(dir, name), content, 'utf-8')
}

main()

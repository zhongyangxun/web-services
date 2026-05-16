/**
 * 本地冒烟：POST /translate
 * 运行（示例）：BASE_URL=http://127.0.0.1:8787 npx tsx scripts/test-translate-api.ts
 * 或先编译再 node dist/...
 */

const BASE_URL = (process.env.BASE_URL ?? 'http://127.0.0.1:8787').replace(
  /\/$/,
  '',
)
const TRANSLATE_URL = `${BASE_URL}/translate`

const logResponse = async (label: string, res: Response): Promise<void> => {
  const text = await res.text()
  let body: unknown = text

  try {
    body = JSON.parse(text) as unknown
  } catch {
    // 非 JSON 格式，保持原样
  }

  console.log(`\n--- ${label} ---`)
  console.log('HTTP', res.status, res.statusText)
  console.log(body)
}

/** application/json */
const postJson = async (): Promise<void> => {
  const body = {
    text: 'The quick brown fox jumps over the lazy dog. Learning a language takes patience and consistent practice. Try selecting individual words or whole phrases above and below.',
  }

  const res = await fetch(TRANSLATE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Id': '1234567890',
    },
    body: JSON.stringify(body),
  })

  await logResponse('application/json', res)
}

const main = async (): Promise<void> => {
  console.log('POST', TRANSLATE_URL)

  await postJson()
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})

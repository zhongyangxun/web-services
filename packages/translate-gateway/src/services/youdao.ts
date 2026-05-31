import crypto from 'crypto'
import type { TranslateResult, YoudaoApiResponse } from './types'

const YOUDAO_API_URL = 'https://openapi.youdao.com/api'
const NO_ERROR_CODE = '0'

export class NoTranslationError extends Error {
  constructor() {
    super('No valid translation found')
    this.name = 'NoTranslationError'
  }
}

const containsChinese = (text: string): boolean => {
  return /[\u4e00-\u9fff]/.test(text)
}

export const youdaoTranslate = async (
  text: string,
): Promise<TranslateResult> => {
  const trimed = text.trim()
  const textLen = trimed.length

  if (textLen <= 1 || textLen > 600) {
    throw new Error('Text length must be between 1 and 600')
  }

  const salt = crypto.randomUUID()
  const curtime = Math.floor(Date.now() / 1000).toString()

  const input =
    textLen <= 20
      ? trimed
      : `${trimed.slice(0, 10)}${textLen}${trimed.slice(-10)}`

  const sign = crypto
    .createHash('sha256')
    .update(
      `${process.env.YOUDAO_APP_KEY}${input}${salt}${curtime}${process.env.YOUDAO_APP_SECRET}`,
    )
    .digest('hex')

  const body = new URLSearchParams({
    q: trimed,
    from: 'en',
    to: 'zh-CHS',
    appKey: process.env.YOUDAO_APP_KEY || '',
    salt,
    signType: 'v3',
    sign,
    curtime,
    strict: 'true',
  })

  const response = await fetch(YOUDAO_API_URL, {
    method: 'POST',
    // fetch 会自动设置 Content-Type: application/x-www-form-urlencoded
    body,
  })

  if (!response.ok) {
    throw new Error(`Youdao API error: ${response.status}`)
  }

  const data: YoudaoApiResponse = (await response.json()) as YoudaoApiResponse

  if (data.errorCode !== NO_ERROR_CODE) {
    throw new Error(`Youdao API error: ${data.errorCode}`)
  }

  if (!data.translation?.[0]) {
    throw new Error('Youdao API error: translation is empty')
  }

  const translation = data.translation[0]

  if (!containsChinese(translation)) {
    throw new NoTranslationError()
  }

  return {
    query: data.query,
    translation,
  }
}

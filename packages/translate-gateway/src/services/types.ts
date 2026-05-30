// 有道 API 返回类型（仅包含必要字段）
export type YoudaoApiResponse = {
  query: string
  translation?: string[]
  errorCode: string
}

export type TranslateResult = {
  query: string
  translation: string
}

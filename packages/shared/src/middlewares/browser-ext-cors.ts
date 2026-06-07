import { MiddlewareHandler } from 'hono'
import { cors } from 'hono/cors'

export const DEFAULT_ALLOWED_HEADERS = ['Content-Type', 'X-Client-Id']

export const parseExtensionOrigins = (ids?: string): string[] => {
  if (!ids?.trim()) return []

  return ids
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => `chrome-extension://${id}`)
}

export type BrowserExtCorsOptions = {
  allowedOrigins: string[]
  allowMethods?: string[]
  allowHeaders?: string[]
  maxAge?: number
}

export const createBrowserExtCorsMiddleware = (
  options: BrowserExtCorsOptions,
): MiddlewareHandler => {
  const {
    allowedOrigins,
    allowMethods = ['GET', 'POST', 'OPTIONS'],
    allowHeaders = DEFAULT_ALLOWED_HEADERS,
    maxAge = 60 * 60 * 24,
  } = options

  return cors({
    origin: allowedOrigins,
    allowMethods,
    allowHeaders,
    maxAge,
  })
}

import { MiddlewareHandler } from 'hono'
import { cors } from 'hono/cors'

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
    allowHeaders = ['Content-Type', 'X-Client-Id'],
    maxAge = 60 * 60 * 24,
  } = options

  return cors({
    origin: allowedOrigins,
    allowMethods,
    allowHeaders,
    maxAge,
  })
}

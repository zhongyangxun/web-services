import { MiddlewareHandler } from 'hono'
import {
  buildCanonicalV1,
  parseV1SignatureHeader,
} from '../request-signature/canonical'
import { hmacSha256Hex } from '../crypto/hmac-sha256'

export const createRequestSignatureMiddleware = (
  secret: string,
): MiddlewareHandler => {
  return async (c, next) => {
    if (!secret) {
      return c.json({ message: 'Internal Server Error' }, 500)
    }

    const clientId = c.req.header('X-Client-Id')
    const timestamp = c.req.header('X-Timestamp')
    const signature = parseV1SignatureHeader(c.req.header('X-Signature'))

    if (!clientId || !timestamp || !signature) {
      if (process.env.NODE_ENV === 'production') {
        // *生产环境返回 401 错误，避免泄露信息
        return c.json({ message: 'Unauthorized' }, 401)
      }

      return c.json(
        {
          message:
            'Required headers(X-Client-Id, X-Timestamp, X-Signature) are missing',
        },
        400,
      )
    }

    // 时效性校验
    const ts = Number(timestamp)
    const now = Math.floor(Date.now() / 1000)
    const MAX_SKEW_SEC = 60 * 5
    if (!Number.isFinite(ts) || Math.abs(ts - now) > MAX_SKEW_SEC) {
      return c.json({ message: 'Unauthorized' }, 401)
    }

    const rawBody = await c.req.text()
    const { method, path } = c.req
    const canonical = buildCanonicalV1({
      method,
      path,
      timestamp,
      clientId,
      body: rawBody,
    })
    const expectedSignature = await hmacSha256Hex(secret, canonical)
    const encoder = new TextEncoder()

    const a = encoder.encode(expectedSignature)
    const b = signature
    // *`crypto.subtle.timingSafeEqual` 两个参数长度不等时，会直接抛错，所以要做 constant time 比较，避免泄露长度信息
    const isEqual =
      a.length === b.length
        ? crypto.subtle.timingSafeEqual(a, b)
        : !crypto.subtle.timingSafeEqual(a, a)

    if (!isEqual) {
      return c.json({ message: 'Unauthorized' }, 401)
    }

    await next()
  }
}

import type { Context, MiddlewareHandler } from 'hono'
import {
  CheckResult,
  RateLimiterDurableObject,
} from '../durable-objects/rate-limiter'

export type RateLimitOptions<TBindings extends Record<string, unknown>> = {
  bindingName: keyof TBindings
  serviceName: string
  routeName: string
  windowMs?: number
  clientMaxRequests?: number // client id 上限
  ipMaxRequests?: number // ip 上限
  clientIdHeader?: string
  ipHeader?: string
}

const isDurableObjectNamespace = (
  namespace: unknown,
): namespace is DurableObjectNamespace<RateLimiterDurableObject> => {
  return (
    typeof namespace === 'object' &&
    namespace !== null &&
    'get' in namespace &&
    'idFromName' in namespace &&
    typeof namespace.get === 'function' &&
    typeof namespace.idFromName === 'function'
  )
}

const handleRateLimitError = (c: Context, result: CheckResult) => {
  c.header(
    'Retry-After',
    Math.floor((result.resetTime - Date.now()) / 1000).toString(),
  )
  return c.json({ message: 'Too many requests, please try again later.' }, 429)
}

export const createDurableObjectRateLimitMiddleware = <
  TBindings extends Record<string, unknown>,
>(
  options: RateLimitOptions<TBindings>,
): MiddlewareHandler<{ Bindings: TBindings }> => {
  const {
    bindingName,
    serviceName,
    routeName,
    windowMs = 60 * 1000,
    clientMaxRequests = 60,
    ipMaxRequests = 120,
    clientIdHeader = 'X-Client-Id',
    ipHeader = 'CF-Connecting-IP',
  } = options

  return async (c, next) => {
    const clientId = c.req.header(clientIdHeader)

    if (!clientId) {
      return c.json({ message: `${clientIdHeader} is required` }, 400)
    }

    const env = c.env

    const namespace = env[bindingName]
    if (!namespace) {
      return c.json({ message: 'Rate limit namespace not found' }, 500)
    }

    if (!isDurableObjectNamespace(namespace)) {
      return c.json(
        { message: 'Rate limit namespace is not a durable object' },
        500,
      )
    }

    const ip = c.req.header(ipHeader) || 'anonymous'
    const doKey = `${serviceName}:${routeName}:${ip}`
    const id = namespace.idFromName(doKey)
    const stub = namespace.get(id)
    const result = await stub.checkDual(
      ip,
      clientId,
      windowMs,
      ipMaxRequests,
      clientMaxRequests,
    )

    if (!result.allowed) {
      const errorResult =
        result.clientResult && !result.clientResult.allowed
          ? result.clientResult
          : result.ipResult
      if (!errorResult) {
        return c.json({ message: 'Rate limit state unavailable.' }, 500)
      }
      return handleRateLimitError(c, errorResult)
    }

    const limitResult = result.clientResult ?? result.ipResult

    if (limitResult) {
      c.header('X-RateLimit-Remaining', limitResult.remaining.toString())
      c.header(
        'X-RateLimit-Reset',
        Math.floor(limitResult.resetTime / 1000).toString(),
      )
    }

    await next()
  }
}

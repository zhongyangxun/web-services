import type { MiddlewareHandler } from 'hono'
import { RateLimiterDurableObject } from '../durable-objects/rate-limiter'

export type RateLimitOptions<TBindings extends Record<string, unknown>> = {
  bindingName: keyof TBindings
  serviceName: string
  routeName: string
  windowMs?: number
  maxRequests?: number
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
    maxRequests = 60,
    clientIdHeader = 'X-Client-Id',
    ipHeader = 'CF-Connecting-IP',
  } = options

  return async (c, next) => {
    const clientId = c.req.header(clientIdHeader)

    if (!clientId) {
      return c.json({ message: 'Client ID is required' }, 400)
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
    const rateKey = `${serviceName}:${routeName}:${ip}:${clientId}`
    const id = namespace.idFromName(rateKey)
    const stub = namespace.get(id)
    const result = await stub.check(windowMs, maxRequests)

    if (!result.allowed) {
      c.header(
        'Retry-After',
        Math.floor((result.resetTime - Date.now()) / 1000).toString(),
      )

      return c.json(
        { message: 'Too many requests, please try again later.' },
        429,
      )
    }

    await next()
  }
}

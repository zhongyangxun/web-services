import type { MiddlewareHandler } from 'hono'
import { RateLimiterDurableObject } from '../durable-objects/rate-limiter'

export type RateLimitOptions = {
  bindingName: string
  serviceName: string
  routeName: string
  windowMs?: number
  maxRequests?: number
  clientIdHeader?: string
  ipHeader?: string
}

const isDurableObjectNamespace = (namespace: unknown) => {
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
  TVariables extends Record<string, unknown>,
>(
  options: RateLimitOptions,
): MiddlewareHandler<{ Bindings: TBindings; Variables: TVariables }> => {
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

    const namespaced =
      namespace as DurableObjectNamespace<RateLimiterDurableObject>

    const ip = c.req.header(ipHeader) || 'anonymous'
    const rateKey = `${serviceName}:${routeName}:${ip}:${clientId}`
    const id = namespaced.idFromName(rateKey)
    const stub = namespaced.get(id)
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

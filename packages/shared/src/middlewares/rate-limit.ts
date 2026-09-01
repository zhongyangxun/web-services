import type { Context, MiddlewareHandler, Next } from 'hono'

import { RATE_LIMIT_EXCEEDED_CODE } from '../constants/error-codes'
import {
  CheckResult,
  RateLimiterDurableObject,
} from '../durable-objects/rate-limiter'
import { isDurableObjectNamespace } from '../durable-objects/utils'

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

export const checkRateLimit = async <TBindings extends Record<string, unknown>>(
  c: Context,
  options: RateLimitOptions<TBindings>,
): Promise<Response | undefined> => {
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

  const clientId = c.req.header(clientIdHeader)

  if (!clientId) {
    return c.json({ message: `${clientIdHeader} is required` }, 400)
  }

  const env = c.env

  const namespace = env[bindingName]
  if (!namespace) {
    return c.json({ message: 'Rate limit namespace not found' }, 500)
  }

  if (!isDurableObjectNamespace<RateLimiterDurableObject>(namespace)) {
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
}

const handleRateLimitError = (c: Context, result: CheckResult) => {
  c.header(
    'Retry-After',
    Math.floor((result.resetTime - Date.now()) / 1000).toString(),
  )
  return c.json(
    {
      message: 'Too many requests, please try again later.',
      code: RATE_LIMIT_EXCEEDED_CODE,
    },
    429,
  )
}

export const createDurableObjectRateLimitMiddleware = <
  TBindings extends Record<string, unknown>,
  TVariables extends Record<string, unknown> = Record<string, unknown>,
>(
  options: RateLimitOptions<TBindings>,
): MiddlewareHandler<{ Bindings: TBindings; Variables: TVariables }> => {
  return async (
    c: Context<{ Bindings: TBindings; Variables: TVariables }>,
    next: Next,
  ) => {
    const blocked = await checkRateLimit(c, options)
    if (blocked) {
      return blocked
    }

    return await next()
  }
}

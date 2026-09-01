export function jsonResponse(data: unknown, status = 200) {
  return Response.json(data, { status })
}

export * from './cache/edge-cache'
export * from './constants/time'
export * from './durable-objects/cost-guard'
export * from './durable-objects/rate-limiter'
export * from './middlewares/browser-ext-cors'
export * from './middlewares/daily-quota'
export * from './middlewares/rate-limit'
export * from './middlewares/request-signature'
export * from './middlewares/timing'

export function jsonResponse(data: unknown, status = 200) {
  return Response.json(data, { status })
}

export * from './middlewares/rate-limit'
export * from './durable-objects/rate-limiter'

export * from './middlewares/browser-ext-cors'

export * from './middlewares/request-signature'

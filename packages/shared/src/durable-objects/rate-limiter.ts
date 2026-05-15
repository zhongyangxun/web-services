import { DurableObject } from 'cloudflare:workers'

type RateLimitRecord = {
  count: number
  resetTime: number
}

type CheckResult = {
  allowed: boolean
  remaining: number
  resetTime: number
}

export class RateLimiterDurableObject extends DurableObject {
  constructor(ctx: DurableObjectState, env: Record<string, unknown>) {
    super(ctx, env)
  }

  async check(windowMs: number, maxRequests: number): Promise<CheckResult> {
    const storageKey = 'current-window'
    const now = Date.now()
    let record = await this.ctx.storage.get<RateLimitRecord>(storageKey)

    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs }
    } else {
      record = { ...record, count: record.count + 1 }
    }

    await this.ctx.storage.put(storageKey, record)

    return {
      allowed: record.count <= maxRequests,
      remaining: Math.max(0, maxRequests - record.count),
      resetTime: record.resetTime,
    }
  }
}

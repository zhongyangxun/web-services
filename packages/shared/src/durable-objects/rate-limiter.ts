import { DurableObject } from 'cloudflare:workers'

type RateLimitRecord = {
  count: number
  resetTime: number
}

export type CheckResult = {
  allowed: boolean
  remaining: number
  resetTime: number
}

export type DualCheckResult = {
  allowed: boolean
  ipResult: CheckResult | null
  clientResult: CheckResult | null
}

export class RateLimiterDurableObject extends DurableObject {
  constructor(ctx: DurableObjectState, env: Record<string, unknown>) {
    super(ctx, env)
  }

  private async checkBucket(
    bucketKey: string,
    now: number,
    windowMs: number,
    maxRequests: number,
  ): Promise<CheckResult> {
    let record = await this.ctx.storage.get<RateLimitRecord>(bucketKey)

    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs }
    } else if (record.count < maxRequests) {
      record = { ...record, count: record.count + 1 }
    } else {
      return {
        allowed: false,
        remaining: 0,
        resetTime: record.resetTime,
      }
    }

    await this.ctx.storage.put(bucketKey, record)

    return {
      allowed: true,
      remaining: maxRequests - record.count,
      resetTime: record.resetTime,
    }
  }

  async checkDual(
    ip: string | 'anonymous',
    clientId: string,
    windowMs: number,
    ipMaxRequests: number,
    clientMaxRequests: number,
  ): Promise<DualCheckResult> {
    const now = Date.now()

    let ipResult: CheckResult | null = null
    // check ip
    if (ip !== 'anonymous') {
      ipResult = await this.checkBucket(
        `ip:${ip}`,
        now,
        windowMs,
        ipMaxRequests,
      )
      if (!ipResult.allowed) {
        return {
          allowed: false,
          ipResult,
          clientResult: null,
        }
      }
    }

    // check client
    const clientResult = await this.checkBucket(
      `client:${clientId}`,
      now,
      windowMs,
      clientMaxRequests,
    )

    return {
      allowed: clientResult.allowed,
      ipResult,
      clientResult,
    }
  }
}

import { DurableObject } from 'cloudflare:workers'
import { getNextMidnightMs } from '../utils/day'

type CostGuardRecord = {
  count: number
  resetTime: number
}

type CostGuardResult = {
  allowed: boolean
  remaining: number
  resetTime: number
}

export class CostGuardDurableObject extends DurableObject {
  constructor(ctx: DurableObjectState, env: Record<string, unknown>) {
    super(ctx, env)
  }

  async reserveDailyQuota(
    dayKey: string,
    maxPerDay: number,
  ): Promise<CostGuardResult> {
    const now = Date.now()
    let record = await this.ctx.storage.get<CostGuardRecord>(dayKey)

    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: getNextMidnightMs() }
    } else if (record.count < maxPerDay) {
      record = { ...record, count: record.count + 1 }
    } else {
      return { allowed: false, remaining: 0, resetTime: record.resetTime }
    }

    await this.ctx.storage.put(dayKey, record)

    return {
      allowed: true,
      remaining: maxPerDay - record.count,
      resetTime: record.resetTime,
    }
  }

  async rollbackDailyQuota(dayKey: string) {
    const record = await this.ctx.storage.get<CostGuardRecord>(dayKey)
    if (!record) {
      throw new Error(`Daily quota record not found for day key: ${dayKey}`)
    }
    record.count = Math.max(record.count - 1, 0)
    await this.ctx.storage.put(dayKey, record)
  }
}

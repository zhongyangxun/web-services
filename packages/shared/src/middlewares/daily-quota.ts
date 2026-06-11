import { MiddlewareHandler } from 'hono'
import { isDurableObjectNamespace } from '../durable-objects/utils'
import { CostGuardDurableObject } from '../durable-objects/cost-guard'
import { DEFAULT_TIME_ZONE, getDayKey } from '../utils/day'
import { Context } from 'hono'
import { DAILY_QUOTA_EXCEEDED_CODE } from '../constants/error-codes'

type DailyQuotaOptions<TBindings extends Record<string, unknown>> = {
  bindingName: keyof TBindings
  serviceName: string
  routeName: string
  maxPerDayEnvKey: string
  skip?: boolean
  timeZone?: string
}

export const createDailyQuotaMiddleware = <
  TBindings extends Record<string, unknown>,
>(
  options: DailyQuotaOptions<TBindings>,
): MiddlewareHandler<{ Bindings: TBindings }> => {
  const {
    bindingName,
    serviceName,
    routeName,
    maxPerDayEnvKey,
    skip = false,
    timeZone = DEFAULT_TIME_ZONE,
  } = options

  return async (c, next) => {
    const env = c.env
    const maxPerDay = Number(env[maxPerDayEnvKey])
    const isValidMaxPerDay = !Number.isNaN(maxPerDay) && maxPerDay > 0
    if (!isValidMaxPerDay) {
      console.warn('Invalid max per day', maxPerDayEnvKey, maxPerDay)
    }
    // 跳过条件：1. 配置了跳过 2. 最大次数不是数字 3. 最大次数小于等于0
    if (skip || !isValidMaxPerDay) {
      return await next()
    }

    const namespace = env[bindingName]
    if (!namespace) {
      return c.json({ message: 'Daily Quota namespace not found' }, 500)
    }

    if (!isDurableObjectNamespace<CostGuardDurableObject>(namespace)) {
      return c.json(
        { message: 'Daily Quota namespace is not a Durable Object' },
        500,
      )
    }

    const doKey = `${serviceName}:${routeName}`
    const id = namespace.idFromName(doKey)
    const stub = namespace.get(id)
    const result = await stub.reserveDailyQuota(
      getDayKey({ timeZone }),
      maxPerDay,
    )

    if (!result.allowed) {
      c.header(
        'Retry-After',
        Math.floor((result.resetTime - Date.now()) / 1000).toString(),
      )
      return c.json(
        {
          message: 'Daily Quota exceeded',
          code: DAILY_QUOTA_EXCEEDED_CODE,
          resetTime: result.resetTime,
        },
        429,
      )
    }

    c.header('X-Daily-Quota-Remaining', result.remaining.toString())

    await next()
  }
}

type RollbackDailyQuotaOptions<TBindings extends Record<string, unknown>> =
  Pick<
    DailyQuotaOptions<TBindings>,
    'bindingName' | 'serviceName' | 'routeName' | 'timeZone'
  > & {
    context: Context<{ Bindings: TBindings }>
  }

export const rollbackDailyQuota = async <
  TBindings extends Record<string, unknown>,
>(
  options: RollbackDailyQuotaOptions<TBindings>,
): Promise<void> => {
  const { bindingName, serviceName, routeName, context, timeZone } = options
  const env = context.env
  const namespace = env[bindingName]
  if (!namespace) {
    console.warn('Daily Quota namespace not found')
    return
  }

  if (!isDurableObjectNamespace<CostGuardDurableObject>(namespace)) {
    console.warn('Daily Quota namespace is not a Durable Object')
    return
  }
  const doKey = `${serviceName}:${routeName}`
  const id = namespace.idFromName(doKey)
  const stub = namespace.get(id)
  await stub.rollbackDailyQuota(getDayKey({ timeZone }))
}

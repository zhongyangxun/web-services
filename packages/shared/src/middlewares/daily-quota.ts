import { Context, MiddlewareHandler } from 'hono'

import { DAILY_QUOTA_EXCEEDED_CODE } from '../constants/error-codes'
import { CostGuardDurableObject } from '../durable-objects/cost-guard'
import { isDurableObjectNamespace } from '../durable-objects/utils'
import { DEFAULT_TIME_ZONE, getDayKey } from '../utils/day'

type DailyQuotaOptions<TBindings extends Record<string, unknown>> = {
  bindingName: keyof TBindings
  serviceName: string
  routeName: string
  maxPerDayEnvKey: string
  skip?: boolean
  timeZone?: string
}

export const checkDailyQuota = async <
  TBindings extends Record<string, unknown>,
>(
  c: Context,
  options: DailyQuotaOptions<TBindings>,
): Promise<Response | undefined> => {
  const {
    bindingName,
    serviceName,
    routeName,
    maxPerDayEnvKey,
    skip = false,
    timeZone = DEFAULT_TIME_ZONE,
  } = options

  const env = c.env
  const maxPerDay = Number(env[maxPerDayEnvKey])
  const isValidMaxPerDay = !Number.isNaN(maxPerDay) && maxPerDay > 0
  if (!isValidMaxPerDay) {
    console.warn('Invalid max per day', maxPerDayEnvKey, maxPerDay)
  }
  // 跳过条件：1. 配置了跳过 2. 最大次数不是有效的数字或小于等于 0
  if (skip || !isValidMaxPerDay) {
    return
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
}

export const createDailyQuotaMiddleware = <
  TBindings extends Record<string, unknown>,
>(
  options: DailyQuotaOptions<TBindings>,
): MiddlewareHandler<{ Bindings: TBindings }> => {
  return async (c, next) => {
    const blocked = await checkDailyQuota(c, options)
    if (blocked) {
      return blocked
    }

    return await next()
  }
}

type RollbackDailyQuotaOptions<TBindings extends Record<string, unknown>> =
  Pick<
    DailyQuotaOptions<TBindings>,
    'bindingName' | 'serviceName' | 'routeName' | 'timeZone'
  > & {
    context: { env: TBindings }
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

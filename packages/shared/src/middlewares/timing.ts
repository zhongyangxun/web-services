import { Context, Env, MiddlewareHandler, Next } from 'hono'

export type TimingMark = [label: string, at: number]

const TIMING_MARKS_KEY = 'TIMING_MARKS' as const

export type TimingVariables = {
  [TIMING_MARKS_KEY]: TimingMark[]
}

type TimingEnv = Env & { Variables: TimingVariables }

/**
 * Timing log middleware
 * * Must be placed at the beginning of the valid request chain, otherwise the request duration cannot be calculated correctly
 * @returns MiddlewareHandler
 */
export const createTimingMiddleware = <
  TEnv extends TimingEnv,
>(): MiddlewareHandler<TEnv> => {
  return async (c: Context<TEnv>, next: Next) => {
    const marks: TimingMark[] = [['start', Date.now()]]
    c.set(TIMING_MARKS_KEY, marks)

    await next()

    const [, start] = marks[0]
    const totalMs = Date.now() - start
    const spans = Object.fromEntries(
      marks.slice(1).map(([label, at]) => [label, at - start]),
    )

    console.log(
      JSON.stringify({
        tag: 'timing',
        method: c.req.method,
        path: new URL(c.req.url).pathname,
        status: c.res.status,
        colo: c.req.raw.cf?.colo,
        totalMs,
        spans,
      }),
    )
  }
}

export const markTiming = <TEnv extends TimingEnv>(
  c: Context<TEnv>,
  label: string,
) => {
  c.get(TIMING_MARKS_KEY)?.push([label, Date.now()])
}

export const createTimingMarkMiddleware =
  <TEnv extends TimingEnv>(label: string): MiddlewareHandler<TEnv> =>
  async (c: Context<TEnv>, next: Next) => {
    markTiming(c, label)
    await next()
  }

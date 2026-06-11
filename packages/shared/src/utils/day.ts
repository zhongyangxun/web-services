export const DEFAULT_TIME_ZONE = 'Asia/Shanghai'

export const getDayKey = ({
  date = new Date(),
  timeZone = DEFAULT_TIME_ZONE,
}: {
  date?: Date
  timeZone?: string
}) => {
  return date.toLocaleDateString('zh-CN', { timeZone }).replace(/\//g, '-')
}

export const getNextMidnightMs = (
  { date = new Date(), timeZone = DEFAULT_TIME_ZONE } = {
    date: new Date(),
    timeZone: DEFAULT_TIME_ZONE,
  },
) => {
  const nextMidnight = new Date(getDayKey({ date, timeZone }))
  nextMidnight.setDate(nextMidnight.getDate() + 1)
  nextMidnight.setHours(0, 0, 0, 0)
  return nextMidnight.getTime()
}

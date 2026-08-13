type EdgeCacheOptions = {
  requestUrl: string
  namespace: string
  version: string
  parts: string[]
}

const CACHE_HEADER = 'X-Cache'
const CACHE_CONTROL_HEADER = 'Cache-Control'

const CACHE_CONTROL = {
  PUBLIC: 'public',
  S_MAXAGE: 's-maxage', // 唯一来源，IDE 可跳转
} as const

const CACHE_STATUS = {
  HIT: 'HIT',
  MISS: 'MISS',
} as const

const cacheControl = (maxAgeSeconds: number) =>
  `${CACHE_CONTROL.PUBLIC}, ${CACHE_CONTROL.S_MAXAGE}=${maxAgeSeconds}`

export const buildCacheKey = (options: EdgeCacheOptions) => {
  const { requestUrl, namespace, version, parts } = options

  return new Request(
    new URL(
      `/cache/${namespace}/${version}/${parts.map(encodeURIComponent).join('/')}`,
      requestUrl,
    ),
    { method: 'GET' },
  )
}

export const asCacheHit = (res: Response) => {
  const headers = new Headers(res.headers)

  headers.set(CACHE_HEADER, CACHE_STATUS.HIT)

  return new Response(res.body, { status: res.status, headers })
}

export const matchEdgeCache = async (
  key: Request,
  cache: Cache = caches.default,
): Promise<Response | undefined> => {
  return cache.match(key)
}

export const putEdgeCache = async (
  ctx: ExecutionContext,
  key: Request,
  res: Response,
  opts: {
    maxAgeSeconds: number
    // Cache condition. If not provided, all responses will be cached.
    shouldCache?: (res: Response) => boolean
  },
): Promise<void> => {
  const { maxAgeSeconds, shouldCache } = opts

  // headers send to client
  res.headers.set(CACHE_HEADER, CACHE_STATUS.MISS)
  res.headers.set(CACHE_CONTROL_HEADER, cacheControl(maxAgeSeconds))

  if (shouldCache === undefined || shouldCache(res)) {
    ctx.waitUntil(caches.default.put(key, res.clone()))
  }
}

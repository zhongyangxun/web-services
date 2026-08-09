type EdgeCacheOptions = {
  requestUrl: string
  namespace: string
  version: string
  parts: string[]
}

const CACHE_HEADER = 'X-Cache'
const CACHE_CONTROL_HEADER = 'Cache-Control'

const CACHE_STATUS = {
  HIT: 'HIT',
  MISS: 'MISS',
} as const

// to client, make sure no client cache
const PRIVATE_CACHE_CONTROL = 'private, no-store'

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
  // delete cache control header to avoid sending to client
  headers.delete(CACHE_CONTROL_HEADER)

  headers.set(CACHE_HEADER, CACHE_STATUS.HIT)
  headers.set(CACHE_CONTROL_HEADER, PRIVATE_CACHE_CONTROL)

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
  res.headers.set(CACHE_CONTROL_HEADER, PRIVATE_CACHE_CONTROL)

  if (shouldCache === undefined || shouldCache(res)) {
    const toCache = res.clone()

    toCache.headers.set(
      CACHE_CONTROL_HEADER,
      `public, max-age=${maxAgeSeconds}`,
    )

    ctx.waitUntil(caches.default.put(key, toCache))
  }
}

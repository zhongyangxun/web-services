type BuildCanonicalV1Params = {
  method: string
  path: string
  timestamp: string
  clientId: string
  body: string
}

const V1_PREFIX = 'v1='

/** SHA-256 HMAC hex 长度（32 字节， 写成 16 进制就是 64 个字符） */
const SIG_HEX_LEN = 64

const encoder = new TextEncoder()

export const buildCanonicalV1 = ({
  method,
  path,
  timestamp,
  clientId,
  body,
}: BuildCanonicalV1Params): string => {
  return `v1\n${method}\n${path}\n${timestamp}\n${clientId}\n${body}`
}

export const parseV1SignatureHeader = (value?: string): Uint8Array | null => {
  if (!value?.startsWith(V1_PREFIX)) {
    return null
  }

  const hex = value.slice(V1_PREFIX.length)
  if (hex.length !== SIG_HEX_LEN || !/^[0-9a-f]+$/i.test(hex)) {
    return null
  }

  return encoder.encode(hex.toLowerCase())
}

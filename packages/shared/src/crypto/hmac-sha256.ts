const encoder = new TextEncoder()

const bytesToHex = (bytes: Uint8Array): string => {
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('')
}

export const hmacSha256Hex = async (
  secret: string,
  message: string,
): Promise<string> => {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const sign = await crypto.subtle.sign('HMAC', key, encoder.encode(message))

  return bytesToHex(new Uint8Array(sign))
}

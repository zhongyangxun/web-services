import { DurableObject } from 'cloudflare:workers'

export const isDurableObjectNamespace = <T extends DurableObject>(
  namespace: unknown,
): namespace is DurableObjectNamespace<T> => {
  return (
    typeof namespace === 'object' &&
    namespace !== null &&
    'get' in namespace &&
    'idFromName' in namespace &&
    typeof namespace.get === 'function' &&
    typeof namespace.idFromName === 'function'
  )
}

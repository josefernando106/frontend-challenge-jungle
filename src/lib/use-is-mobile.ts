import { useSyncExternalStore } from 'react'

/** Abaixo de 768px a interface usa os frames mobile do layout (barra inferior, barras de topo próprias). */
const MOBILE_QUERY = '(max-width: 767.98px)'

function subscribe(onChange: () => void) {
  const media = window.matchMedia(MOBILE_QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

export function useIsMobile() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  )
}

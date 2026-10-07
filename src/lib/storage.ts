/** Acesso tolerante a falhas ao localStorage/sessionStorage (modo privado, quota, SSR). */

function store(kind: 'local' | 'session'): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

export function readJson<T>(key: string, kind: 'local' | 'session' = 'local'): T | null {
  try {
    const raw = store(kind)?.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function writeJson(key: string, value: unknown, kind: 'local' | 'session' = 'local') {
  try {
    store(kind)?.setItem(key, JSON.stringify(value))
  } catch {
    
  }
}

export function removeKey(key: string, kind: 'local' | 'session' = 'local') {
  try {
    store(kind)?.removeItem(key)
  } catch {
    
  }
}

export const STORAGE_KEYS = {
  session: 'nftmkt:session',
  guestCartId: 'nftmkt:guest-cart-id',
  checkoutDraft: (userId: string) => `nftmkt:checkout-draft:${userId}`,
  checkoutAttempt: (userId: string) => `nftmkt:checkout-attempt:${userId}`,
  walletConnection: (userId: string) => `nftmkt:wallet-connection:${userId}`,
} as const

import { useSyncExternalStore } from 'react'
import type { Session, User } from '@/contracts'
import { readJson, removeKey, STORAGE_KEYS, writeJson } from '@/lib/storage'

/**
 * Estado da sessão (token + usuário). Persistido em localStorage para sobreviver a refresh;
 * a validade real é sempre confirmada pela API (GET /auth/session).
 */

export type SessionState =
  | { status: 'anonymous'; endedBy?: 'logout' | 'expired' }
  | { status: 'authenticated'; token: string; user: User; expiresAt: string }

type Listener = (next: SessionState, prev: SessionState) => void

function initial(): SessionState {
  const saved = readJson<Session>(STORAGE_KEYS.session)
  if (saved?.token && saved.user) {
    return { status: 'authenticated', token: saved.token, user: saved.user, expiresAt: saved.expiresAt }
  }
  return { status: 'anonymous' }
}

let state: SessionState = initial()
const listeners = new Set<Listener>()

function set(next: SessionState) {
  const prev = state
  state = next
  if (next.status === 'authenticated') {
    writeJson(STORAGE_KEYS.session, { token: next.token, user: next.user, expiresAt: next.expiresAt })
  } else {
    removeKey(STORAGE_KEYS.session)
  }
  listeners.forEach((l) => l(next, prev))
}

export const sessionStore = {
  get: () => state,
  token: () => (state.status === 'authenticated' ? state.token : null),
  userId: () => (state.status === 'authenticated' ? state.user.id : null),
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  signIn(session: Session) {
    set({ status: 'authenticated', token: session.token, user: session.user, expiresAt: session.expiresAt })
  },
  updateUser(user: User, expiresAt?: string) {
    if (state.status !== 'authenticated') return
    set({ ...state, user, expiresAt: expiresAt ?? state.expiresAt })
  },
  signOut() {
    if (state.status === 'anonymous') return
    set({ status: 'anonymous', endedBy: 'logout' })
  },
  /** Chamado quando a API responde 401 para o token atual. */
  expire(token: string) {
    if (state.status === 'authenticated' && state.token === token) {
      set({ status: 'anonymous', endedBy: 'expired' })
    }
  },
}

// Sincroniza logout/login entre abas.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEYS.session) return
    const next = initial()
    const current = sessionStore.token()
    const nextToken = next.status === 'authenticated' ? next.token : null
    if (current !== nextToken) set(next.status === 'anonymous' ? { status: 'anonymous', endedBy: 'logout' } : next)
  })
}

export function useSession(): SessionState {
  return useSyncExternalStore(
    (cb) => sessionStore.subscribe(cb),
    () => state,
  )
}

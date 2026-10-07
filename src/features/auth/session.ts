import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { LoginRequest, RegisterRequest, Session } from '@/contracts'
import { api } from '@/api/endpoints'
import { qk } from '@/api/query-keys'
import { queryClient } from '@/lib/query-client'
import { readJson, removeKey, STORAGE_KEYS } from '@/lib/storage'
import { realtimeStore } from '@/realtime/realtime-store'
import { sessionStore } from './session-store'

/** Revalida a sessão persistida com a API antes do primeiro render. */
export async function bootstrapSession() {
  if (sessionStore.get().status !== 'authenticated') return
  try {
    const res = await api.auth.session()
    sessionStore.updateUser(res.user, res.expiresAt)
  } catch {
    // 401 já encerra a sessão via interceptor; falha de rede mantém a sessão otimista.
  }
}

/**
 * Efeitos colaterais de mudanças de sessão: limpeza de dados privados em cache,
 * avisos ao usuário e reavaliação dos guards de rota.
 */
export function installSessionEffects(onChange: () => void) {
  return sessionStore.subscribe((next, prev) => {
    const prevId = prev.status === 'authenticated' ? prev.user.id : null
    const nextId = next.status === 'authenticated' ? next.user.id : null

    if (prevId !== nextId) {
      if (prevId) {
        void queryClient.cancelQueries({ queryKey: qk.user.all(prevId) })
        queryClient.removeQueries({ queryKey: qk.user.all(prevId) })
      }
      queryClient.removeQueries({ queryKey: ['cart'] })
      realtimeStore.clearNotices()
      if (prevId && next.status === 'anonymous' && next.endedBy === 'logout') {
        removeKey(STORAGE_KEYS.checkoutDraft(prevId), 'session')
        removeKey(STORAGE_KEYS.checkoutAttempt(prevId), 'session')
        removeKey(STORAGE_KEYS.walletConnection(prevId), 'session')
      }
    }
    if (next.status === 'anonymous' && next.endedBy === 'expired') {
      toast.error('Sua sessão expirou', {
        id: 'session-expired',
        description: 'Entre novamente para continuar de onde parou.',
      })
    }
    onChange()
  })
}

async function completeSignIn(session: Session) {
  const guestCartId = readJson<string>(STORAGE_KEYS.guestCartId)
  sessionStore.signIn(session)
  if (guestCartId) {
    try {
      const cart = await api.cart.merge(guestCartId)
      queryClient.setQueryData(qk.cart(session.user.id), cart)
    } catch {
      // Sem carrinho do visitante para mesclar: segue normalmente.
    } finally {
      removeKey(STORAGE_KEYS.guestCartId)
    }
  }
}

export function useLogin() {
  return useMutation({
    mutationFn: (body: LoginRequest) => api.auth.login(body),
    onSuccess: completeSignIn,
  })
}

export function useRegister() {
  return useMutation({
    mutationFn: (body: RegisterRequest) => api.auth.register(body),
    onSuccess: completeSignIn,
  })
}

export async function logout() {
  const token = sessionStore.token()
  sessionStore.signOut()
  if (token) {
    // Revoga no servidor com o token anterior (o store já está limpo).
    await api.auth.logout(token).catch(() => undefined)
  }
  toast.success('Você saiu da conta.', { id: 'logout' })
}

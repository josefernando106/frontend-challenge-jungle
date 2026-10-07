import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ChangePasswordRequest, NetworkId, UpdateProfileRequest, UpsertWalletRequest, User, Wallet } from '@/contracts'
import { api } from '@/api/endpoints'
import { qk } from '@/api/query-keys'
import { sessionStore, useSession } from '@/features/auth/session-store'

function useUserId() {
  const session = useSession()
  return session.status === 'authenticated' ? session.user.id : 'anonymous'
}

export function useProfile() {
  const userId = useUserId()
  return useQuery({
    queryKey: qk.user.profile(userId),
    queryFn: ({ signal }) => api.profile.get(signal),
    enabled: userId !== 'anonymous',
  })
}

function useProfileMutation<TVars>(fn: (vars: TVars) => Promise<User>) {
  const queryClient = useQueryClient()
  const userId = useUserId()
  return useMutation({
    mutationFn: fn,
    onSuccess: (user) => {
      queryClient.setQueryData(qk.user.profile(userId), user)
      sessionStore.updateUser(user)
    },
  })
}

export const useUpdateProfile = () => useProfileMutation((body: UpdateProfileRequest) => api.profile.update(body))
export const useUpdateAvatar = () => useProfileMutation((dataUrl: string) => api.profile.updateAvatar(dataUrl))

export function useChangePassword() {
  return useMutation({ mutationFn: (body: ChangePasswordRequest) => api.profile.changePassword(body) })
}

export function useWallets() {
  const userId = useUserId()
  return useQuery({
    queryKey: qk.user.wallets(userId),
    queryFn: ({ signal }) => api.wallets.list(signal),
    enabled: userId !== 'anonymous',
  })
}

export function useSaveWallet() {
  const queryClient = useQueryClient()
  const userId = useUserId()
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: UpsertWalletRequest }) =>
      id ? api.wallets.update(id, body) : api.wallets.create(body),
    onSuccess: (wallet) => {
      queryClient.setQueryData<Wallet[]>(qk.user.wallets(userId), (old = []) =>
        old.some((w) => w.id === wallet.id) ? old.map((w) => (w.id === wallet.id ? wallet : w)) : [...old, wallet],
      )
      void queryClient.invalidateQueries({ queryKey: qk.user.wallets(userId) })
    },
  })
}

export function useConnectWallet() {
  return useMutation({
    mutationFn: ({ walletId, network }: { walletId: string; network: NetworkId }) => api.wallets.connect(walletId, network),
  })
}

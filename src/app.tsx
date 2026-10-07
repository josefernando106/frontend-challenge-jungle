import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { queryClient } from '@/lib/query-client'
import { bootstrapSession, installSessionEffects } from '@/features/auth/session'
import { router } from '@/router'

export async function renderApp(container: HTMLElement) {
  await bootstrapSession()
  // Reavalia guards de rota (ex.: sessão expirada numa página privada → login).
  installSessionEffects(() => void router.invalidate())

  createRoot(container).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  )
}

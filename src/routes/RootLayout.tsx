import { lazy, Suspense, useEffect, useRef } from 'react'
import { Outlet, useRouterState } from '@tanstack/react-router'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { BottomNav, MobileTopBar } from '@/components/layout/MobileChrome'
import { Toaster } from '@/components/ui/sonner'
import { RealtimeProvider } from '@/realtime/RealtimeProvider'
import { env } from '@/lib/env'
import { useIsMobile } from '@/lib/use-is-mobile'
import { cn } from '@/lib/utils'

const MockPanel = env.enableMocks ? lazy(() => import('@/mocks/devtools/MockPanel')) : null

/** Ao trocar de rota, move o foco para o conteúdo principal (leitores de tela anunciam a nova página). */
function useFocusOnNavigate() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const main = document.getElementById('conteudo')
    const heading = main?.querySelector<HTMLElement>('h1')
    if (heading) {
      heading.tabIndex = -1
      heading.focus({ preventScroll: true })
    } else {
      main?.focus({ preventScroll: true })
    }
  }, [pathname])
}

export function RootLayout() {
  useFocusOnNavigate()
  const isMobile = useIsMobile()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isHome = pathname === '/'
  const isAuth = pathname === '/entrar' || pathname === '/cadastro'
  // Mobile (frames do layout): início com barra inferior; login/cadastro em tela cheia; demais telas com barra de topo.
  const chrome = !isMobile ? <Header /> : isHome || isAuth ? null : <MobileTopBar />
  return (
    <>
      <a
        href="#conteudo"
        className="sr-only z-50 rounded-xl bg-primary px-4 py-3 font-semibold focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Pular para o conteúdo
      </a>
      <RealtimeProvider />
      {chrome}
      <main id="conteudo" tabIndex={-1} className={cn('outline-none', isMobile && isHome && 'pb-24')}>
        <Outlet />
      </main>
      {!isMobile && <Footer />}
      {isMobile && isHome && <BottomNav />}
      <Toaster position={isMobile ? 'top-center' : 'bottom-right'} closeButton richColors={false} />
      {MockPanel && (
        <Suspense fallback={null}>
          <MockPanel />
        </Suspense>
      )}
    </>
  )
}

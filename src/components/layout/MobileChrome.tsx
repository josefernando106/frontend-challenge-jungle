import { Link, useRouter, useRouterState } from '@tanstack/react-router'
import { ChevronLeft, Compass, Heart, House, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CartButton, MobileMenu, RealtimeIndicator } from './Header'

const TITLES: [RegExp, string][] = [
  [/^\/carrinho$/, 'Carrinho de NFTs'],
  [/^\/checkout$/, 'Pagamento com carteira'],
  [/^\/pedidos\//, 'Seu pedido'],
]

export function MobileTopBar() {
  const router = useRouter()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const title = TITLES.find(([re]) => re.test(pathname))?.[1]
  const back = () => {
    if (router.history.canGoBack()) router.history.back()
    else void router.navigate({ to: '/' })
  }
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 bg-background/95 px-4 backdrop-blur">
      <button
        type="button"
        onClick={back}
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface text-primary hover:bg-accent"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        <span className="sr-only">Voltar</span>
      </button>
      <p className="min-w-0 flex-1 truncate text-center text-base font-medium" aria-hidden="true">
        {title}
      </p>
      <div className="flex shrink-0 items-center">
        <RealtimeIndicator />
        <CartButton className="size-9" />
        <MobileMenu className="size-9" />
      </div>
    </header>
  )
}

const navItem =
  'flex size-11 items-center justify-center rounded-full text-foreground transition-colors hover:text-primary [&_svg]:size-5'

export function BottomNav() {
  const hash = useRouterState({ select: (s) => s.location.hash })
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 rounded-t-2xl border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto grid h-16 max-w-md grid-cols-5 items-center justify-items-center px-2">
        <li>
          <Link
            to="/"
            className={cn(navItem, hash !== 'catalogo' && 'text-primary')}
            aria-current={hash !== 'catalogo' ? 'page' : undefined}
            activeOptions={{ exact: true, includeHash: false }}
          >
            <House aria-hidden="true" />
            <span className="sr-only">Início</span>
          </Link>
        </li>
        <li>
          <Link to="/conta/favoritos" className={navItem}>
            <Heart aria-hidden="true" />
            <span className="sr-only">Favoritos</span>
          </Link>
        </li>
        <li className="relative">
          <Link
            to="/"
            hash="catalogo"
            className="-mt-8 flex size-14 items-center justify-center rounded-full border-4 border-background bg-primary text-primary-foreground shadow-lg hover:bg-primary-hover [&_svg]:size-6"
          >
            <Compass aria-hidden="true" />
            <span className="sr-only">Explorar o mercado</span>
          </Link>
          <RealtimeIndicator className="absolute -top-7 -right-2" />
        </li>
        <li>
          <CartButton className={cn(navItem, 'rounded-full')} />
        </li>
        <li>
          <MobileMenu className={navItem} icon={<UserRound aria-hidden="true" />} />
        </li>
      </ul>
    </nav>
  )
}

import { lazy, Suspense, useState, type ReactNode } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { Menu, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useSession } from '@/features/auth/session-store'
import { logout } from '@/features/auth/session'
import { useCart } from '@/features/cart/hooks'
import { useRealtimeState } from '@/realtime/realtime-store'
import { safeRedirect } from '@/routes/search'
import { Logo } from './Logo'
import { cn } from '@/lib/utils'

const UserMenu = lazy(() => import('./UserMenu'))

const navLinkClass =
  'relative flex h-full items-center px-1 text-sm transition-colors hover:text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-transparent after:content-[""]'
const navActiveClass = 'text-primary after:bg-primary'

function useLoginRedirect() {
  const href = useRouterState({ select: (s) => s.location.href })
  return href === '/' ? undefined : safeRedirect(href)
}

function useGoToSearch() {
  const navigate = useNavigate()
  return async () => {
    await navigate({ to: '/', hash: 'catalogo', search: (prev) => prev })
    requestAnimationFrame(() => document.getElementById('catalog-search')?.focus())
  }
}

function ComingSoon({ children, className }: { children: string; className?: string }) {
  return (
    <span
      className={cn(navLinkClass, 'cursor-not-allowed text-muted-foreground hover:text-muted-foreground', className)}
      title="Em breve"
    >
      {children}
      <span className="sr-only"> (em breve)</span>
    </span>
  )
}

export function CartButton({ className }: { className?: string }) {
  const { data } = useCart()
  const count = data?.itemCount ?? 0
  return (
    <Button asChild variant="ghost" size="icon" className={cn('relative', className)}>
      <Link to="/carrinho" aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`} data-testid="header-cart">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M17.1558 20.25H9.89066C6.78905 20.25 4.26569 17.7267 4.26569 14.6251V8.85947C4.26569 5.9762 2.82861 3.30739 0.421544 1.72031C-0.0107343 1.43531 -0.130077 0.853876 0.154921 0.421598C0.439919 -0.0107278 1.02131 -0.130118 1.45368 0.154974C2.82776 1.06097 3.94254 2.2559 4.73969 3.63167C4.91195 3.82466 6.30104 5.29699 8.57821 5.29699H19.3738C22.3191 5.24191 24.6245 8.19769 23.8544 11.0406L22.6117 15.9939C21.9829 18.4998 19.7394 20.25 17.1558 20.25ZM5.90415 6.64234C6.06001 7.36238 6.14068 8.10483 6.14068 8.85947V14.6251C6.14068 16.6928 7.82292 18.375 9.89066 18.375H17.1558C18.8782 18.375 20.3739 17.2082 20.793 15.5376L22.0358 10.5844C22.4933 8.89509 21.1233 7.13931 19.3738 7.17198H8.57817C7.54828 7.17198 6.65185 6.94993 5.90415 6.64234ZM9.42191 22.8281C9.42191 22.1809 8.89724 21.6563 8.25004 21.6563C6.69511 21.7182 6.69647 23.9387 8.25004 24C8.89724 24 9.42191 23.4753 9.42191 22.8281ZM18.75 22.8281C18.75 22.1809 18.2253 21.6563 17.5781 21.6563C16.0232 21.7182 16.0245 23.9387 17.5781 24C18.2253 24 18.75 23.4753 18.75 22.8281ZM20.3113 9.98446C20.3113 9.46668 19.8916 9.04697 19.3738 9.04697H8.95316C7.7093 9.09647 7.71023 10.8729 8.95316 10.922H19.3738C19.8916 10.922 20.3113 10.5022 20.3113 9.98446Z" fill="#F5F1EB"/>
        </svg>
        {count > 0 && (
          <span
            aria-hidden="true"
            className="absolute top-1 right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] leading-none font-bold text-primary-foreground"
          >
            {count > 9 ? '9+' : count}
          </span>
        )}
      </Link>
    </Button>
  )
}

export function RealtimeIndicator({ className }: { className?: string }) {
  const { status } = useRealtimeState()
  const label =
    status === 'connected' ? 'Tempo real conectado' : status === 'idle' ? 'Tempo real inativo' : 'Reconectando tempo real…'
  return (
    <span className={cn('flex items-center px-1', className)} title={label} data-testid="realtime-status" data-status={status}>
      <span
        aria-hidden="true"
        className={cn('size-2 rounded-full', status === 'connected' ? 'bg-success' : 'animate-pulse bg-warning')}
      />
      <span className="sr-only">{label}</span>
    </span>
  )
}

function AccountArea() {
  const session = useSession()
  const redirect = useLoginRedirect()
  if (session.status !== 'authenticated') {
    return (
      <Button asChild size="xs" className="h-8 px-3">
        <Link to="/entrar" search={{ redirect }}>
          <svg width="21" height="20" viewBox="0 0 21 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M17.0268 8.559H6.99268" stroke="#140D0A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M14.5879 6.129L17.0279 8.559L14.5879 10.989" stroke="#140D0A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12.5009 4.81667C12.2259 1.83333 11.1092 0.75 6.66752 0.75C0.750021 0.75 0.750021 2.675 0.750021 8.45833C0.750021 14.2417 0.750021 16.1667 6.66752 16.1667C11.1092 16.1667 12.2259 15.0833 12.5009 12.1" stroke="#140D0A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Entrar
        </Link>
      </Button>
    )
  }
  return (
    <Suspense fallback={<span className="block size-9" aria-hidden="true" />}>
      <UserMenu user={session.user} />
    </Suspense>
  )
}

export function MobileMenu({ icon, className }: { icon?: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false)
  const session = useSession()
  const navigate = useNavigate()
  const redirect = useLoginRedirect()
  const close = () => setOpen(false)
  const item = 'block rounded-md px-4 py-3 text-base hover:bg-accent'
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Abrir menu" className={className}>
          {icon ?? <Menu aria-hidden="true" />}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[86vw] max-w-sm bg-background p-0">
        <SheetHeader className="border-b border-border p-6">
          <SheetTitle className="text-lg tracking-[0.12em]">KURIO</SheetTitle>
          <SheetDescription className="sr-only">Navegação principal</SheetDescription>
        </SheetHeader>
        <nav aria-label="Navegação principal (mobile)" className="flex flex-col gap-1 px-3">
          <Link to="/" className={item} onClick={close} activeOptions={{ exact: true, includeHash: false }}>
            Início
          </Link>
          <Link to="/" hash="catalogo" className={item} onClick={close}>
            Mercado
          </Link>
          <ComingSoon className="h-auto px-4 py-3 text-base">Criadores</ComingSoon>
          <ComingSoon className="h-auto px-4 py-3 text-base">Aprenda</ComingSoon>
          <Link to="/carrinho" className={item} onClick={close}>
            Carrinho
          </Link>
          {session.status === 'authenticated' ? (
            <>
              <Link to="/conta/perfil" className={item} onClick={close}>
                Perfil
              </Link>
              <Link to="/conta/carteiras" className={item} onClick={close}>
                Carteiras
              </Link>
              <Link to="/conta/favoritos" className={item} onClick={close}>
                Favoritos
              </Link>
              <button
                type="button"
                className={cn(item, 'text-left')}
                onClick={async () => {
                  close()
                  await logout()
                  void navigate({ to: '/' })
                }}
              >
                Sair
              </button>
            </>
          ) : (
            <Link to="/entrar" search={{ redirect }} className={item} onClick={close}>
              Entrar / Criar conta
            </Link>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  )
}

export function Header() {
  const goToSearch = useGoToSearch()
  const { pathname, hash } = useRouterState({ select: (s) => ({ pathname: s.location.pathname, hash: s.location.hash }) })
  const onHome = pathname === '/'
  const marketActive = (onHome && hash === 'catalogo') || pathname.startsWith('/nft/')
  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="container-page grid h-14 grid-cols-[1fr_auto] items-center gap-4 border-b border-border md:h-16 lg:grid-cols-[1fr_auto_1fr]">
        <Logo className="justify-self-start" />
        <nav aria-label="Navegação principal" className="hidden h-full items-stretch gap-8 lg:flex">
          <Link
            to="/"
            className={cn(navLinkClass, onHome && !marketActive && navActiveClass)}
            aria-current={onHome && !marketActive ? 'page' : undefined}
            activeOptions={{ exact: true, includeHash: false }}
          >
            Início
          </Link>
          <Link to="/" hash="catalogo" className={cn(navLinkClass, marketActive && navActiveClass)}>
            Mercado
          </Link>
          <ComingSoon>Criadores</ComingSoon>
          <ComingSoon>Aprenda</ComingSoon>
        </nav>
        <div className="flex items-center gap-1 justify-self-end">
          <RealtimeIndicator />
          <Button variant="ghost" size="icon" aria-label="Buscar NFTs" onClick={() => void goToSearch()}>
            <Search aria-hidden="true" />
          </Button>
          <CartButton />
          <div className="ml-2 hidden lg:block">
            <AccountArea />
          </div>
          <div className="lg:hidden">
            <MobileMenu />
          </div>
        </div>
      </div>
    </header>
  )
}

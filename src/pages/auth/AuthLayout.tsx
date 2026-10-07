import type { ReactNode } from 'react'
import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { XIcon } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { HomeContent } from '@/pages/HomePage'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/lib/use-is-mobile'

type AuthMode = 'login' | 'register'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.9l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z" />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#3B6FD4"
        d="M13.5 22v-8.2h2.8l.4-3.2h-3.2V8.5c0-.9.3-1.6 1.6-1.6h1.7V4.1c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.4H7.3v3.2h2.8V22h3.4Z"
      />
    </svg>
  )
}

/** Login social fora do escopo: deixa explícito que nada foi autenticado. */
function SocialLogin() {
  const unavailable = (provider: string) =>
    toast.info(`Entrar com ${provider} não está disponível nesta demonstração. Use e-mail e senha.`)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-xs md:-mx-10" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span>Ou continue com</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <p className="sr-only">Ou continue com</p>
      <Button type="button" variant="outline" size="sm" className="h-10 border-border text-xs" onClick={() => unavailable('Google')}>
        <GoogleIcon />
        Continuar com Google
      </Button>
      <Button type="button" variant="outline" size="sm" className="h-10 border-border text-xs" onClick={() => unavailable('Facebook')}>
        <FacebookIcon />
        Continuar com Facebook
      </Button>
    </div>
  )
}

/**
 * Login e cadastro como modal sobre a página inicial (layout do Figma). As duas telas continuam
 * sendo rotas próprias (/entrar e /cadastro): acesso direto, refresh e redirect seguem funcionando.
 */
export function AuthLayout({
  mode,
  description,
  redirect,
  children,
}: {
  mode: AuthMode
  description: string
  redirect?: string
  children: ReactNode
}) {
  const router = useRouter()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const close = () => {
    if (router.history.canGoBack()) router.history.back()
    else void navigate({ to: '/', replace: true })
  }
  const tab = (active: boolean) =>
    cn('rounded-sm px-1 transition-colors hover:text-primary', active ? 'text-primary' : 'text-foreground')

  if (isMobile) {
    // Frame mobile: tela cheia, sem modal.
    return (
      <div className="flex min-h-dvh flex-col gap-6 px-6 pt-16 pb-10" data-testid="auth-page">
        <Link to="/" className="self-center rounded-sm text-3xl font-bold tracking-[0.12em]" aria-label="Kurio — início">
          KURIO
        </Link>
        <h1 className="mt-12 text-center text-base font-medium">
          {mode === 'login' ? 'Entrar' : 'Criar perfil de colecionador'}
        </h1>
        <p className="sr-only">{description}</p>
        {children}
        <SocialLogin />
        <p className="text-center text-xs">
          {mode === 'login' ? 'Novo no Kurio? ' : 'Já tem uma conta? '}
          <Link
            to={mode === 'login' ? '/cadastro' : '/entrar'}
            search={{ redirect }}
            replace
            className="rounded-sm text-primary underline underline-offset-4"
          >
            {mode === 'login' ? 'Crie uma conta' : 'Entre'}
          </Link>
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Fundo decorativo: inerte (sem foco, clique ou leitura) enquanto o modal está aberto. */}
      <div inert>
        <HomeContent search={{}} />
      </div>
      <DialogPrimitive.Root open onOpenChange={(open) => !open && close()}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[470px] -translate-x-1/2 -translate-y-1/2 flex-col gap-6 overflow-y-auto rounded-sm bg-surface px-6 pt-10 pb-8 shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 md:px-10 md:pt-12"
            data-testid="auth-dialog"
            onOpenAutoFocus={(e) => {
              // Foco inicial no primeiro campo do formulário (não no botão de fechar).
              const field = (e.currentTarget as HTMLElement | null)?.querySelector<HTMLElement>('form input')
              if (field) {
                e.preventDefault()
                field.focus()
              }
            }}
          >
            <DialogPrimitive.Close className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-sm text-primary hover:bg-accent">
              <XIcon className="size-4" aria-hidden="true" />
              <span className="sr-only">Fechar</span>
            </DialogPrimitive.Close>

            <div className="flex flex-col items-center gap-6">
              <DialogPrimitive.Title className="sr-only">{mode === 'login' ? 'Entrar' : 'Criar conta'}</DialogPrimitive.Title>
              <nav aria-label="Entrar ou criar conta" className="flex items-center text-xl font-medium">
                <Link
                  to="/entrar"
                  search={{ redirect }}
                  replace
                  className={tab(mode === 'login')}
                  aria-current={mode === 'login' ? 'page' : undefined}
                >
                  Entrar
                </Link>
                <span className="mx-1.5 h-6 w-px bg-primary" aria-hidden="true" />
                <Link
                  to="/cadastro"
                  search={{ redirect }}
                  replace
                  className={tab(mode === 'register')}
                  aria-current={mode === 'register' ? 'page' : undefined}
                >
                  Criar conta
                </Link>
              </nav>
              <DialogPrimitive.Description className="text-center text-[13px] leading-4">{description}</DialogPrimitive.Description>
            </div>

            {children}
            <SocialLogin />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  )
}

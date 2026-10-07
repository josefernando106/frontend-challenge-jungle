import { useState } from 'react'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/form/Field'
import { PasswordInput } from '@/components/form/PasswordInput'
import { applyServerErrors } from '@/components/form/server-errors'
import { useLogin } from '@/features/auth/session'
import { isApiError } from '@/api/http'
import { AuthLayout } from './AuthLayout'

const route = getRouteApi('/entrar')

const schema = z.object({
  email: z.string().trim().email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe a senha.'),
})
type LoginForm = z.infer<typeof schema>

export function LoginPage() {
  const { redirect, reason } = route.useSearch()
  const navigate = useNavigate()
  const login = useLogin()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(schema), mode: 'onTouched' })

  const onSubmit = handleSubmit((values) => {
    setFormError(null)
    login.mutate(values, {
      onSuccess: () => void navigate({ href: redirect ?? '/', replace: true }),
      onError: (error) => {
        if (isApiError(error) && error.code === 'INVALID_CREDENTIALS') setFormError(error.message)
        else setFormError(applyServerErrors(error, setError))
      },
    })
  })

  return (
    <AuthLayout
      mode="login"
      description="Entre para gerenciar sua carteira, coleção e perfil de criador."
      redirect={redirect}
    >
      {reason === 'expired' && (
        <div role="alert" className="rounded-sm border border-warning/60 bg-warning/10 px-4 py-3 text-xs">
          Sua sessão expirou. Entre novamente para continuar de onde parou.
        </div>
      )}
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4" aria-label="Formulário de login">
        <Field label="E-mail" error={errors.email?.message} required hideLabel>
          <Input type="email" autoComplete="email" placeholder="contato@email.com" {...register('email')} />
        </Field>
        <Field label="Senha" error={errors.password?.message} required hideLabel>
          <PasswordInput autoComplete="current-password" placeholder="Senha" {...register('password')} />
        </Field>
        <button
          type="button"
          className="-mt-1 self-end rounded-sm text-sm text-primary underline-offset-4 hover:underline"
          onClick={() => toast.info('A recuperação de senha não está disponível nesta demonstração.')}
        >
          Esqueceu a senha?
        </button>
        {formError && (
          <p role="alert" className="text-xs font-medium text-destructive" data-testid="login-error">
            {formError}
          </p>
        )}
        <Button type="submit" size="sm" className="h-11 text-base font-bold" disabled={login.isPending}>
          {login.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
          {login.isPending ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
      <details className="rounded-sm border border-border px-3 py-2 text-xs">
        <summary className="cursor-pointer text-muted-foreground">Contas de demonstração</summary>
        <ul className="mt-2 flex flex-col gap-1">
          <li>ana@nft.dev / Senha@123</li>
          <li>bruno@nft.dev / Senha@123</li>
          <li>carla@nft.dev / Senha@123</li>
        </ul>
      </details>
    </AuthLayout>
  )
}

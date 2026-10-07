import { useState } from 'react'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/form/Field'
import { PasswordInput } from '@/components/form/PasswordInput'
import { applyServerErrors } from '@/components/form/server-errors'
import { useRegister } from '@/features/auth/session'
import { passwordRule } from '@/features/auth/schemas'
import { isApiError } from '@/api/http'
import { AuthLayout } from './AuthLayout'
import { useIsMobile } from '@/lib/use-is-mobile'

const route = getRouteApi('/cadastro')

const schema = z
  .object({
    name: z.string().trim().min(2, 'Informe seu nome (mín. 2 caracteres).'),
    email: z.string().trim().email('Informe um e-mail válido.'),
    password: passwordRule,
    confirm: z.string().min(1, 'Confirme a senha.'),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'As senhas não coincidem.' })
type RegisterForm = z.infer<typeof schema>

export function RegisterPage() {
  const { redirect } = route.useSearch()
  const navigate = useNavigate()
  const registerUser = useRegister()
  const isMobile = useIsMobile()
  const [formError, setFormError] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterForm>({ resolver: zodResolver(schema), mode: 'onTouched' })

  const onSubmit = handleSubmit(({ name, email, password }) => {
    setFormError(null)
    setConflict(false)
    registerUser.mutate(
      { name, email, password },
      {
        onSuccess: () => void navigate({ href: redirect ?? '/', replace: true }),
        onError: (error) => {
          setConflict(isApiError(error) && error.code === 'CONFLICT')
          setFormError(applyServerErrors(error, setError))
        },
      },
    )
  })

  return (
    <AuthLayout
      mode="register"
      description="Crie seu perfil de colecionador e conecte uma carteira quando quiser."
      redirect={redirect}
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4" aria-label="Formulário de cadastro">
        <Field label="Nome de usuário" error={errors.name?.message} required hideLabel>
          <Input autoComplete="name" placeholder="Nome de usuário" {...register('name')} />
        </Field>
        <Field label="E-mail" error={errors.email?.message} required hideLabel>
          <Input type="email" autoComplete="email" placeholder="Digite seu e-mail" {...register('email')} />
        </Field>
        <Field label="Senha" error={errors.password?.message} hint="Mín. 8 caracteres, com letras e números." required hideLabel>
          <PasswordInput autoComplete="new-password" placeholder="Senha" {...register('password')} />
        </Field>
        <Field label="Confirmar senha" error={errors.confirm?.message} required hideLabel>
          <PasswordInput autoComplete="new-password" placeholder="Confirmar senha" {...register('confirm')} />
        </Field>
        {conflict && (
          <p className="text-xs">
            Já tem conta?{' '}
            <Link to="/entrar" search={{ redirect }} replace className="font-medium text-primary underline">
              Entrar
            </Link>
          </p>
        )}
        {formError && (
          <p role="alert" className="text-xs font-medium text-destructive">
            {formError}
          </p>
        )}
        <Button type="submit" size="sm" className="mt-2 h-11 text-base font-bold" disabled={registerUser.isPending}>
          {registerUser.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
          {registerUser.isPending ? 'Criando conta…' : isMobile ? 'Criar perfil' : 'Criar conta'}
        </Button>
      </form>
    </AuthLayout>
  )
}

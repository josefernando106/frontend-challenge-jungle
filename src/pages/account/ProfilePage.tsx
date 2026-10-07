import { useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Camera, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { User } from '@/contracts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Field } from '@/components/form/Field'
import { applyServerErrors } from '@/components/form/server-errors'
import { ErrorState } from '@/components/states'
import { errorMessage } from '@/lib/errors'
import { useChangePassword, useProfile, useUpdateAvatar, useUpdateProfile } from '@/features/account/hooks'
import { passwordRule } from '@/features/auth/schemas'
import { AVATAR_MAX_BYTES, AVATAR_TYPES, resizeImage } from '@/lib/image'
import { AccountLayout } from './AccountLayout'

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Nome deve ter entre 2 e 60 caracteres.').max(60, 'Nome deve ter entre 2 e 60 caracteres.'),
  username: z
    .string()
    .trim()
    .regex(/^[a-z0-9._]{3,30}$/, 'Use 3–30 caracteres: letras minúsculas, números, "." ou "_".'),
  email: z.string().trim().email('Informe um e-mail válido.'),
  bio: z.string().max(280, 'Máximo de 280 caracteres.'),
})
type ProfileForm = z.infer<typeof profileSchema>

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual.'),
    newPassword: passwordRule,
    confirm: z.string().min(1, 'Confirme a nova senha.'),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'As senhas não coincidem.' })
type PasswordForm = z.infer<typeof passwordSchema>

function ProfileDetailsForm({ profile }: { profile: User }) {
  const update = useUpdateProfile()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    reset,
    control,
    formState: { errors, isDirty },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    mode: 'onTouched',
    defaultValues: { name: profile.name, username: profile.username, email: profile.email, bio: profile.bio },
  })

  const bio = useWatch({ control, name: 'bio' })

  const onSubmit = handleSubmit((values) => {
    setFormError(null)
    update.mutate(values, {
      onSuccess: (user) => {
        reset({ name: user.name, username: user.username, email: user.email, bio: user.bio })
        toast.success('Perfil atualizado')
      },
      onError: (error) => setFormError(applyServerErrors(error, setError)),
    })
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5 rounded-[20px] bg-card p-5 md:p-[30px]" aria-labelledby="profile-title">
      <h2 id="profile-title" className="font-mono text-[22px] font-bold">
        Dados pessoais
      </h2>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Nome" error={errors.name?.message} required>
          <Input autoComplete="name" {...register('name')} />
        </Field>
        <Field label="Nome de usuário" error={errors.username?.message} required>
          <Input autoComplete="username" {...register('username')} />
        </Field>
        <Field label="E-mail" error={errors.email?.message} required className="md:col-span-2">
          <Input type="email" autoComplete="email" {...register('email')} />
        </Field>
        <Field label="Bio" error={errors.bio?.message} hint={`${bio?.length ?? 0}/280`} className="md:col-span-2">
          <Textarea rows={4} className="rounded-[20px] bg-white text-[#2b2b2b]" {...register('bio')} />
        </Field>
      </div>
      {formError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {formError}
        </p>
      )}
      <Button type="submit" size="sm" className="self-start" disabled={update.isPending || !isDirty}>
        {update.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
        Salvar alterações
      </Button>
    </form>
  )
}

function AvatarForm({ profile }: { profile: User }) {
  const upload = useUpdateAvatar()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const onFile = async (file: File | undefined) => {
    setError(null)
    if (!file) return
    if (!AVATAR_TYPES.includes(file.type)) {
      setError('Formato não suportado. Use PNG, JPEG ou WEBP.')
      return
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setError('Arquivo muito grande (máx. 5 MB).')
      return
    }
    try {
      const dataUrl = await resizeImage(file)
      upload.mutate(dataUrl, {
        onSuccess: () => toast.success('Avatar atualizado'),
        onError: (e) => setError(errorMessage(e)),
      })
    } catch {
      setError('Não foi possível ler a imagem.')
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <section aria-labelledby="avatar-title" className="flex flex-col items-center gap-4 rounded-[20px] bg-card p-6 text-center">
      <h2 id="avatar-title" className="font-mono text-[22px] font-bold">
        Avatar
      </h2>
      <img
        src={profile.avatarUrl}
        alt={`Avatar de ${profile.name}`}
        width={120}
        height={120}
        className="size-30 rounded-full object-cover ring-4 ring-primary/40"
        data-testid="profile-avatar"
      />
      <input
        ref={inputRef}
        id="avatar-input"
        type="file"
        accept={AVATAR_TYPES.join(',')}
        className="sr-only"
        aria-describedby={error ? 'avatar-error avatar-hint' : 'avatar-hint'}
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      <Button asChild variant="outline" size="xs" className="h-10 cursor-pointer px-4">
        <label htmlFor="avatar-input">
          {upload.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Camera aria-hidden="true" />}
          Alterar avatar
        </label>
      </Button>
      <p id="avatar-hint" className="text-xs text-muted-foreground">
        PNG, JPEG ou WEBP. Redimensionado para 256 px.
      </p>
      {error && (
        <p id="avatar-error" role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}

function PasswordChangeForm() {
  const change = useChangePassword()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema), mode: 'onTouched' })

  const onSubmit = handleSubmit(({ currentPassword, newPassword }) => {
    setFormError(null)
    change.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          reset({ currentPassword: '', newPassword: '', confirm: '' })
          toast.success('Senha alterada com sucesso')
        },
        onError: (error) => setFormError(applyServerErrors(error, setError)),
      },
    )
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5 rounded-[20px] bg-card p-5 md:p-[30px]" aria-labelledby="password-title">
      <h2 id="password-title" className="font-mono text-[22px] font-bold">
        Alterar senha
      </h2>
      <div className="grid gap-5 md:grid-cols-3">
        <Field label="Senha atual" error={errors.currentPassword?.message} required>
          <Input type="password" autoComplete="current-password" {...register('currentPassword')} />
        </Field>
        <Field label="Nova senha" error={errors.newPassword?.message} hint="Mín. 8, letras e números." required>
          <Input type="password" autoComplete="new-password" {...register('newPassword')} />
        </Field>
        <Field label="Confirmar nova senha" error={errors.confirm?.message} required>
          <Input type="password" autoComplete="new-password" {...register('confirm')} />
        </Field>
      </div>
      {formError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {formError}
        </p>
      )}
      <Button type="submit" size="sm" className="self-start" disabled={change.isPending}>
        {change.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
        Alterar senha
      </Button>
    </form>
  )
}

export function ProfilePage() {
  const { data: profile, isPending, isError, error, refetch, isRefetching } = useProfile()

  useEffect(() => {
    document.title = 'Perfil · Kurio'
  }, [])

  return (
    <AccountLayout title="Minha conta">
      {isPending ? (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]" aria-busy="true">
          <Skeleton className="h-72 rounded-[20px]" />
          <Skeleton className="h-96 rounded-[20px]" />
        </div>
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} retrying={isRefetching} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <AvatarForm profile={profile} />
          <div className="flex min-w-0 flex-col gap-6">
            <ProfileDetailsForm key={profile.id} profile={profile} />
            <PasswordChangeForm />
          </div>
        </div>
      )}
    </AccountLayout>
  )
}

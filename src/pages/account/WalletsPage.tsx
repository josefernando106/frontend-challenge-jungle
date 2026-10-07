import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { NetworkId, Wallet, WalletRole } from '@/contracts'
import { NETWORKS, WALLET_PROVIDERS } from '@/contracts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Field } from '@/components/form/Field'
import { applyServerErrors } from '@/components/form/server-errors'
import { ErrorState } from '@/components/states'
import { useSaveWallet, useWallets } from '@/features/account/hooks'
import { AccountLayout } from './AccountLayout'

const walletSchema = z.object({
  label: z.string().trim().min(2, 'Nome deve ter entre 2 e 40 caracteres.').max(40, 'Nome deve ter entre 2 e 40 caracteres.'),
  provider: z.enum(['metamask', 'coinbase', 'walletconnect'], { message: 'Selecione o provedor.' }),
  address: z
    .string()
    .trim()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Endereço inválido (0x + 40 caracteres hexadecimais).'),
  networks: z.array(z.enum(['ethereum', 'polygon', 'arbitrum'])).min(1, 'Selecione ao menos uma rede.'),
})
type WalletForm = z.infer<typeof walletSchema>

function WalletCard({ role, wallet }: { role: WalletRole; wallet?: Wallet }) {
  const save = useSaveWallet()
  const [formError, setFormError] = useState<string | null>(null)
  const title = role === 'primary' ? 'Carteira principal' : 'Carteira secundária'
  const prefix = `wallet-${role}`
  const {
    register,
    handleSubmit,
    control,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm<WalletForm>({
    resolver: zodResolver(walletSchema),
    mode: 'onTouched',
    defaultValues: wallet
      ? { label: wallet.label, provider: wallet.provider, address: wallet.address, networks: wallet.networks }
      : { label: '', provider: undefined, address: '', networks: ['ethereum'] },
  })

  const onSubmit = handleSubmit((values) => {
    setFormError(null)
    save.mutate(
      { id: wallet?.id, body: { ...values, role } },
      {
        onSuccess: (saved) => {
          reset({ label: saved.label, provider: saved.provider, address: saved.address, networks: saved.networks })
          toast.success(wallet ? `${title} atualizada` : `${title} cadastrada`)
        },
        onError: (error) => setFormError(applyServerErrors(error, setError, { role: 'address' })),
      },
    )
  })

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-labelledby={`${prefix}-title`}
      className="flex flex-col gap-5 rounded-[20px] bg-card p-5 md:p-[30px]"
      data-testid={`wallet-form-${role}`}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id={`${prefix}-title`} className="font-mono text-[22px] font-bold">
          {title}
        </h2>
        <span className="rounded-full bg-accent px-3 py-1 text-xs">{wallet ? 'Cadastrada' : 'Não cadastrada'}</span>
      </div>
      <Field label="Nome da carteira" error={errors.label?.message} required>
        <Input {...register('label')} placeholder="Ex.: MetaMask pessoal" />
      </Field>
      <Controller
        control={control}
        name="provider"
        render={({ field }) => (
          <div className="flex flex-col gap-2">
            <label htmlFor={`${prefix}-provider`} className="text-base font-semibold">
              Provedor<span aria-hidden="true" className="text-brand">*</span>
            </label>
            <Select value={field.value ?? ''} onValueChange={field.onChange}>
              <SelectTrigger
                id={`${prefix}-provider`}
                className="w-full"
                onBlur={field.onBlur}
                aria-invalid={errors.provider ? true : undefined}
                aria-describedby={errors.provider ? `${prefix}-provider-error` : undefined}
              >
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {WALLET_PROVIDERS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.provider && (
              <p id={`${prefix}-provider-error`} role="alert" className="text-sm font-medium text-destructive">
                {errors.provider.message}
              </p>
            )}
          </div>
        )}
      />
      <Field label="Endereço" error={errors.address?.message} hint="Formato 0x seguido de 40 caracteres hexadecimais." required>
        <Input {...register('address')} placeholder="0x…" autoComplete="off" spellCheck={false} className="font-mono" />
      </Field>
      <Controller
        control={control}
        name="networks"
        render={({ field }) => (
          <fieldset aria-describedby={errors.networks ? `${prefix}-networks-error` : undefined}>
            <legend className="mb-3 font-semibold">
              Redes suportadas<span aria-hidden="true" className="text-brand">*</span>
            </legend>
            <div className="flex flex-wrap gap-5">
              {NETWORKS.map((n) => {
                const id = `${prefix}-net-${n.id}`
                const checked = field.value?.includes(n.id) ?? false
                return (
                  <div key={n.id} className="flex items-center gap-2">
                    <Checkbox
                      id={id}
                      checked={checked}
                      className="size-5 border-2"
                      onCheckedChange={(v) => {
                        const set = new Set<NetworkId>(field.value ?? [])
                        if (v === true) set.add(n.id)
                        else set.delete(n.id)
                        field.onChange(NETWORKS.map((x) => x.id).filter((x) => set.has(x)))
                      }}
                    />
                    <label htmlFor={id}>{n.label}</label>
                  </div>
                )
              })}
            </div>
            {errors.networks && (
              <p id={`${prefix}-networks-error`} role="alert" className="mt-2 text-sm font-medium text-destructive">
                {errors.networks.message}
              </p>
            )}
          </fieldset>
        )}
      />
      {formError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {formError}
        </p>
      )}
      <Button type="submit" size="sm" className="self-start" disabled={save.isPending || (!!wallet && !isDirty)}>
        {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
        {wallet ? 'Salvar alterações' : 'Cadastrar carteira'}
      </Button>
    </form>
  )
}

export function WalletsPage() {
  const { data, isPending, isError, error, refetch, isRefetching } = useWallets()
  return (
    <AccountLayout title="Carteiras">
      <p className="mb-6 max-w-2xl text-muted-foreground">
        Cadastre até duas carteiras: a principal é sugerida no pagamento. A conexão é simulada — nenhuma extensão real é usada.
      </p>
      {isPending ? (
        <div className="grid gap-6 lg:grid-cols-2" aria-busy="true">
          <Skeleton className="h-[480px] rounded-[20px]" />
          <Skeleton className="h-[480px] rounded-[20px]" />
        </div>
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} retrying={isRefetching} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {(['primary', 'secondary'] as const).map((role) => {
            const wallet = data.find((w) => w.role === role)
            return <WalletCard key={`${role}-${wallet?.id ?? 'new'}`} role={role} wallet={wallet} />
          })}
        </div>
      )}
    </AccountLayout>
  )
}

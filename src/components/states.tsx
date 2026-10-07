import type { ReactNode } from 'react'
import { AlertTriangle, RefreshCw, SearchX, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { isApiError } from '@/api/http'
import { errorMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'


export function ErrorState({
  error,
  onRetry,
  retrying,
  title = 'Não foi possível carregar',
  className,
}: {
  error: unknown
  onRetry?: () => void
  retrying?: boolean
  title?: string
  className?: string
}) {
  const offline = isApiError(error) && error.isNetwork
  const Icon = offline ? WifiOff : AlertTriangle
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center gap-4 rounded-md bg-card px-6 py-10 text-center', className)}
    >
      <Icon className="size-10 text-warning" aria-hidden="true" />
      <div className="space-y-1">
        <h2 className="text-lg font-medium">{title}</h2>
        <p className="text-muted-foreground">{errorMessage(error)}</p>
      </div>
      {onRetry && (
        <Button size="sm" onClick={onRetry} disabled={retrying}>
          <RefreshCw className={cn(retrying && 'animate-spin')} aria-hidden="true" />
          {retrying ? 'Tentando…' : 'Tentar novamente'}
        </Button>
      )}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string
  description?: ReactNode
  action?: ReactNode
  icon?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center gap-4 rounded-md bg-card px-6 py-12 text-center', className)}>
      {icon ?? <SearchX className="size-10 text-brand" aria-hidden="true" />}
      <div className="space-y-1">
        <h2 className="text-lg font-medium">{title}</h2>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}

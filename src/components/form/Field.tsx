import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface FieldProps {
  label: ReactNode
  error?: string
  hint?: ReactNode
  className?: string
  /** Controle do formulário; recebe id, aria-invalid e aria-describedby automaticamente. */
  children: ReactElement<Record<string, unknown>>
  required?: boolean
  hideLabel?: boolean
}

/** Campo com label, dica e mensagem de erro associadas ao controle (WCAG 1.3.1 / 3.3.1). */
export function Field({ label, error, hint, className, children, required, hideLabel }: FieldProps) {
  const id = useId()
  const controlId = (children.props.id as string | undefined) ?? `${id}-control`
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className={cn('flex items-center gap-1', hideLabel && 'sr-only')}>
        <Label htmlFor={controlId} className="text-sm font-medium md:text-base">
          {label}
        </Label>
        {required && (
          <span aria-hidden="true" className="font-semibold text-brand">
            *
          </span>
        )}
      </div>
      {isValidElement(children) &&
        cloneElement(children, {
          id: controlId,
          'aria-invalid': error ? true : undefined,
          'aria-describedby': describedBy,
          'aria-required': required || undefined,
        })}
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="flex items-center gap-1.5 text-xs font-medium text-destructive" role="alert">
          <span aria-hidden="true">⚠</span>
          {error}
        </p>
      )}
    </div>
  )
}

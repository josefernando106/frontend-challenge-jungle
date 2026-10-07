import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { isApiError } from '@/api/http'


export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fieldMap: Record<string, Path<T>> = {},
): string | null {
  if (!isApiError(error)) return 'Ocorreu um erro inesperado.'
  const entries = Object.entries(error.fieldErrors)
  let applied = false
  for (const [field, message] of entries) {
    const target = (fieldMap[field] ?? field) as Path<T>
    setError(target, { type: 'server', message }, { shouldFocus: !applied })
    applied = true
  }
  if (applied) return null
  if (error.isNetwork) return 'Sem conexão. Verifique sua internet e tente novamente.'
  if (error.isTimeout) return 'O servidor demorou a responder. Tente novamente.'
  return error.message
}

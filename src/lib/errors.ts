import { isApiError } from '@/api/http'

/** Mensagem amigável para qualquer falha de transporte/API. */
export function errorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.isNetwork) return 'Sem conexão com o servidor. Verifique sua internet.'
    if (error.isTimeout) return 'O servidor demorou a responder.'
    if (error.status && error.status >= 500) return 'O serviço está instável no momento.'
    return error.message
  }
  return 'Ocorreu um erro inesperado.'
}

import { z } from 'zod'

/** Mesma regra aplicada pela API (cadastro e troca de senha). */
export const passwordRule = z
  .string()
  .min(8, 'Mínimo de 8 caracteres.')
  .regex(/[A-Za-z]/, 'Inclua ao menos uma letra.')
  .regex(/\d/, 'Inclua ao menos um número.')

import { z } from 'zod'

export const buyerSchema = z.object({
  fullName: z.string().trim().min(3, 'Informe o nome completo.').max(80, 'Máximo de 80 caracteres.'),
  email: z.string().trim().email('Informe um e-mail válido.'),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[\d\s()-]{10,20}$/, 'Informe um telefone válido, com DDD.'),
  country: z.string().trim().min(2, 'Informe o país.'),
})

export type BuyerForm = z.infer<typeof buyerSchema>

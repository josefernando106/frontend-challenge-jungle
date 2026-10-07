import type { EthAmount } from '@/contracts'

/**
 * Aritmética de ETH em ponto fixo (18 casas, wei) usando BigInt.
 * Evita erros de ponto flutuante: "0.1" + "0.2" === "0.3".
 */

const DECIMALS = 18
const SCALE = 10n ** BigInt(DECIMALS)
const ETH_PATTERN = /^\d+(\.\d{1,18})?$/

export function isEthAmount(value: string): boolean {
  return ETH_PATTERN.test(value.trim())
}

export function toWei(amount: EthAmount): bigint {
  const value = amount.trim()
  if (!ETH_PATTERN.test(value)) throw new Error(`Valor ETH inválido: "${amount}"`)
  const [int, frac = ''] = value.split('.')
  return BigInt(int) * SCALE + BigInt(frac.padEnd(DECIMALS, '0'))
}

export function fromWei(wei: bigint): EthAmount {
  const negative = wei < 0n
  const abs = negative ? -wei : wei
  const int = abs / SCALE
  const frac = (abs % SCALE).toString().padStart(DECIMALS, '0').replace(/0+$/, '')
  return `${negative ? '-' : ''}${int}${frac ? `.${frac}` : ''}`
}

export function addEth(...amounts: EthAmount[]): EthAmount {
  return fromWei(amounts.reduce((acc, a) => acc + toWei(a), 0n))
}

export function subEth(a: EthAmount, b: EthAmount): EthAmount {
  return fromWei(toWei(a) - toWei(b))
}

export function mulEth(amount: EthAmount, quantity: number): EthAmount {
  if (!Number.isInteger(quantity)) throw new Error('Quantidade deve ser inteira')
  return fromWei(toWei(amount) * BigInt(quantity))
}

/** Percentual inteiro (0–100), arredondado para baixo no wei. */
export function percentOfEth(amount: EthAmount, percent: number): EthAmount {
  return fromWei((toWei(amount) * BigInt(Math.round(percent * 100))) / 10000n)
}

export function compareEth(a: EthAmount, b: EthAmount): -1 | 0 | 1 {
  const x = toWei(a)
  const y = toWei(b)
  return x === y ? 0 : x < y ? -1 : 1
}

export function minEth(amounts: EthAmount[]): EthAmount {
  return amounts.reduce((min, a) => (compareEth(a, min) < 0 ? a : min))
}

export function maxEth(amounts: EthAmount[]): EthAmount {
  return amounts.reduce((max, a) => (compareEth(a, max) > 0 ? a : max))
}

export function isZeroEth(amount: EthAmount): boolean {
  return toWei(amount) === 0n
}

/** Formata para exibição preservando a precisão exata (sem arredondar). */
export function formatEth(amount: EthAmount, options: { suffix?: boolean } = {}): string {
  const { suffix = true } = options
  const normalized = fromWei(toWei(amount))
  const [int, frac] = normalized.split('.')
  const intFormatted = Number(int).toLocaleString('pt-BR')
  const value = frac ? `${intFormatted},${frac}` : intFormatted
  return suffix ? `${value} ETH` : value
}

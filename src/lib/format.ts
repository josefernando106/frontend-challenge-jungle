/** Endereço de carteira abreviado: 0x1234…abcd. */
export const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`

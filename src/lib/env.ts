/** Configuração lida das variáveis VITE_* (ver .env.example). */
export const env = {
  enableMocks: import.meta.env.VITE_ENABLE_MOCKS === 'true',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api',
  socketUrl: (import.meta.env.VITE_SOCKET_URL ?? 'wss://realtime.nft-market.mock').replace(/\/$/, ''),
  httpTimeoutMs: Number(import.meta.env.VITE_HTTP_TIMEOUT_MS ?? 8000),
}

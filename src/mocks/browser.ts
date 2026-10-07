import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'
import { realtimeHandler } from './realtime'
import { settleDueOrders } from './domain'
import { createControl } from './control'
import { getScenario, setScenario } from './db'

/**
 * Inicializa a camada de mocks (REST via Service Worker + Socket.IO via interceptação de WebSocket).
 * Precisa terminar ANTES de o socket.io-client ser carregado: o engine.io-client captura
 * `globalThis.WebSocket` no momento da importação.
 */
export async function startMocks() {
  const control = createControl()
  window.__mock = control

  // Controles por URL: ?scenario=<id> e ?mockReset=1 (removidos da URL em seguida).
  const url = new URL(window.location.href)
  const scenarioParam = url.searchParams.get('scenario')
  const resetParam = url.searchParams.get('mockReset')
  if (resetParam) control.reset({ reload: false })
  if (scenarioParam) setScenario(scenarioParam)
  if (scenarioParam || resetParam) {
    url.searchParams.delete('scenario')
    url.searchParams.delete('mockReset')
    window.history.replaceState(window.history.state, '', url)
  }

  const worker = setupWorker(...handlers, realtimeHandler)
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: true,
    serviceWorker: { url: '/mockServiceWorker.js' },
  })

  // Liquidação periódica de pedidos pendentes (também ocorre a cada requisição).
  window.setInterval(() => settleDueOrders(), 500)

  document.documentElement.dataset.mockScenario = getScenario().id
}

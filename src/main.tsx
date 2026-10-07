import '@fontsource/roboto-mono/latin-400.css'
import '@fontsource/roboto-mono/latin-500.css'
import '@fontsource/roboto-mono/latin-700.css'
import './styles/index.css'
import { env } from '@/lib/env'

/**
 * Inicialização: MSW (quando habilitado) primeiro, depois a aplicação. Baixar os dois em paralelo
 * foi medido e piorou o LCP em rede lenta (disputa de banda) — ver ARCHITECTURE.md › Performance.
 * O socket.io-client é importado sob demanda pelo RealtimeProvider, já com o WebSocket interceptado.
 */
async function bootstrap() {
  if (env.enableMocks) {
    const { startMocks } = await import('./mocks/browser')
    await startMocks()
  }
  const { renderApp } = await import('./app')
  await renderApp(document.getElementById('root')!)
}

void bootstrap()

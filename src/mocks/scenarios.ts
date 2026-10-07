/**
 * Cenários de rede/negócio configuráveis e reproduzíveis.
 * Seleção: `?scenario=<id>` na URL (persistido), painel de mocks ou `window.__mock.setScenario(id)`.
 */

export interface ScenarioConfig {
  id: string
  label: string
  description: string
  /** Latência base (ms) aplicada a todas as rotas REST. */
  latency: { min: number; max: number }
  /** Latências alternadas lenta/rápida no catálogo, forçando respostas fora de ordem. */
  outOfOrder?: boolean
  /** Catálogo sempre vazio. */
  emptyCatalog?: boolean
  /** Sem conexão: REST com erro de rede e Socket.IO recusado. */
  offline?: boolean
  /** Todas as leituras de catálogo/detalhe/carrinho retornam 500. */
  serverError?: boolean
  /** As N primeiras leituras de catálogo/detalhe falham com 503 e depois recuperam. */
  transientFailures?: number
  /** Mutations de favoritos retornam 500. */
  favoritesFail?: boolean
  /** Duração da sessão. */
  sessionTtlMs: number
  /** Preço do primeiro item muda no momento da confirmação do pedido. */
  priceChangeOnCheckout?: boolean
  /** Edição do primeiro item esgota no momento da confirmação do pedido. */
  soldOutOnCheckout?: boolean
  /** POST /orders cria o pedido mas a primeira resposta excede o timeout do cliente. */
  orderTimeout?: boolean
  /** Liquidação do pagamento é recusada. */
  paymentDeclined?: boolean
  /** A carteira recusa a conexão. */
  walletRejected?: boolean
  /** Tempo até a liquidação do pedido (pendente → confirmado/recusado). */
  settleDelayMs: number
}

const BASE: Omit<ScenarioConfig, 'id' | 'label' | 'description'> = {
  latency: { min: 120, max: 350 },
  sessionTtlMs: 30 * 60 * 1000,
  settleDelayMs: 2500,
}

export const SCENARIOS: ScenarioConfig[] = [
  { ...BASE, id: 'default', label: 'Padrão', description: 'Sucesso com latência curta.' },
  {
    ...BASE,
    id: 'slow',
    label: 'Rede lenta',
    description: 'Latência fixa de 2,5 s em todas as chamadas.',
    latency: { min: 2500, max: 2500 },
  },
  {
    ...BASE,
    id: 'variable-latency',
    label: 'Latência variável',
    description: 'Latência entre 150 ms e 2 s (pseudoaleatória com seed fixa).',
    latency: { min: 150, max: 2000 },
  },
  {
    ...BASE,
    id: 'out-of-order',
    label: 'Respostas fora de ordem',
    description: 'Consultas de catálogo alternam 1,5 s / 150 ms: a resposta antiga chega depois da nova.',
    outOfOrder: true,
  },
  { ...BASE, id: 'empty', label: 'Catálogo vazio', description: 'Listagem sem resultados.', emptyCatalog: true },
  { ...BASE, id: 'offline', label: 'Sem conexão', description: 'Erro de rede no REST e Socket.IO indisponível.', offline: true },
  { ...BASE, id: 'server-error', label: 'Erro 500', description: 'Leituras de catálogo, detalhe e carrinho falham com 500.', serverError: true },
  {
    ...BASE,
    id: 'transient-error',
    label: 'Falha transitória',
    description: 'As 3 primeiras leituras do catálogo/detalhe falham com 503; depois recuperam.',
    transientFailures: 3,
  },
  {
    ...BASE,
    id: 'session-expired',
    label: 'Sessão curta',
    description: 'Sessões expiram 20 s após o login.',
    sessionTtlMs: 20_000,
  },
  { ...BASE, id: 'favorites-failure', label: 'Falha em favoritos', description: 'Incluir/remover favorito retorna 500 (rollback otimista).', favoritesFail: true },
  {
    ...BASE,
    id: 'price-change',
    label: 'Preço alterado na compra',
    description: 'O preço do 1º item sobe 15% no momento da confirmação.',
    priceChangeOnCheckout: true,
  },
  {
    ...BASE,
    id: 'sold-out',
    label: 'Edição esgotada na compra',
    description: 'A edição do 1º item esgota no momento da confirmação.',
    soldOutOnCheckout: true,
  },
  {
    ...BASE,
    id: 'order-timeout',
    label: 'Timeout no pedido',
    description: 'O pedido é criado, mas a 1ª resposta excede o timeout; a nova tentativa recupera o mesmo pedido.',
    orderTimeout: true,
  },
  { ...BASE, id: 'payment-declined', label: 'Pagamento recusado', description: 'A liquidação do pedido é recusada.', paymentDeclined: true },
  { ...BASE, id: 'wallet-rejected', label: 'Carteira recusa conexão', description: 'A conexão da carteira é recusada pelo usuário.', walletRejected: true },
]

export function findScenario(id: string | null | undefined): ScenarioConfig {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0]
}

/** PRNG determinístico (mulberry32) para latências variáveis reproduzíveis. */
export function createRng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

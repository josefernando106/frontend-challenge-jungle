# Arquitetura e decisões técnicas

Contratos REST e eventos: [API.md](./API.md). Resultados Lighthouse: [../lighthouse/SUMMARY.md](../lighthouse/SUMMARY.md).

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm install` | Dependências (Node ≥ 20) |
| `npm run dev` | Desenvolvimento com mocks (MSW) em http://localhost:5173 |
| `npm run build` / `npm run preview` | Build de demonstração (mocks ativos) / servidor em :4173 |
| `npm run typecheck` · `npm run lint` | TypeScript (strict) · ESLint |
| `npx playwright install chromium` | Navegador dos testes (uma vez) |
| `npm run test:e2e` | Playwright (desktop 1440 + mobile 390), relatório em `playwright-report/` |
| `npm run test:e2e:update` | Regera os baselines visuais em `e2e/__screenshots__` |
| `npm run lighthouse` | Build + auditoria (3× por página/perfil), saída em `lighthouse/` |
| `npm run assets` | Regera a arte SVG dos NFTs/avatares (`public/assets`) |

Variáveis (`.env.example`; o modo `mocks` usa `.env.mocks`): `VITE_ENABLE_MOCKS`, `VITE_API_BASE_URL`, `VITE_SOCKET_URL`, `VITE_HTTP_TIMEOUT_MS`.

Contas fictícias (senha `Senha@123`): `ana@nft.dev` (2 carteiras, 2 favoritos), `bruno@nft.dev` (1 carteira), `carla@nft.dev` (sem carteiras).

### Cenários de simulação

Selecione com `?scenario=<id>` (persistido), no painel **Mocks** (canto inferior esquerdo) ou `window.__mock.setScenario(id)`. `?mockReset=1` ou "Resetar tudo" restaura o seed e o cenário padrão.

| id | Efeito |
| --- | --- |
| `default` | Sucesso, latência 120–350 ms |
| `slow` | Latência fixa de 2,5 s (skeletons) |
| `variable-latency` | 150 ms–2 s, PRNG com seed fixa (reprodutível) |
| `out-of-order` | Consultas do catálogo alternam 1,5 s / 150 ms (resposta antiga chega depois) |
| `empty` | Catálogo vazio |
| `offline` | REST com erro de rede, Socket.IO recusado |
| `server-error` | 500 em catálogo, detalhe e carrinho |
| `transient-error` | 3 primeiras leituras de listagem/detalhe → 503, depois recupera |
| `session-expired` | Sessão de 20 s |
| `favorites-failure` | Mutations de favorito → 500 (rollback otimista) |
| `price-change` / `sold-out` | Preço sobe 15% / edição esgota no momento da confirmação |
| `order-timeout` | Pedido criado, mas a 1ª resposta excede o timeout do cliente |
| `payment-declined` | Liquidação recusada |
| `wallet-rejected` | Carteira recusa a conexão |

Ações do painel / `window.__mock`: alterar preço/estoque de um NFT (emite `nft.updated`), reenviar o último evento (duplicata) ou um evento antigo, derrubar o socket por 5 s, expirar sessões, liquidar pedidos pendentes.

## Organização

```
src/
  contracts/      tipos de transporte (REST + eventos) compartilhados com os mocks
  api/            Axios (interceptors, ApiError), endpoints tipados, query keys
  features/       hooks de dados e componentes por domínio (auth, catalog, cart, checkout, orders, account, favorites)
  realtime/       socket.io-client, filtro de eventos, aplicação no cache, status/avisos
  pages/          telas (rotas carregadas sob demanda, exceto o início)
  routes/         search params (validação/serialização) e layout raiz
  components/     UI compartilhada; components/ui = shadcn/ui adaptado à identidade
  mocks/          MSW: fixtures, banco simulado, cenários, handlers REST, servidor Socket.IO, painel
  lib/            ETH em ponto fixo, storage, env, utilitários
e2e/              Playwright (12 cenários do enunciado + regressão visual)
```

Componentes, hooks e Axios não contêm respostas fictícias: a única fonte de dados é a rede (interceptada pelo MSW quando `VITE_ENABLE_MOCKS=true`).

## Roteamento (TanStack Router)

Rotas definidas em código (`src/router.tsx`). Search params com serialização plana (`?q=lua&cat=art,music&sort=price_asc&page=2`), validados por rota (`src/routes/search.ts`) — valores inválidos são descartados. Rotas privadas (`/checkout`, `/pedidos/$id`, `/conta/*`) ficam sob um layout com `beforeLoad` que redireciona para `/entrar?redirect=<href>` (com `reason=expired` quando a sessão expirou). `redirect` só aceita caminhos internos. Rotas inexistentes → 404; NFT/pedido inexistente → estado "não encontrado".

## Estado remoto e cache (TanStack Query)

Política (`src/lib/query-client.ts`):

- `staleTime` 30 s (facetas 5 min, carrinho 10 s); `gcTime` 5 min; `refetchOnWindowFocus` ligado.
- **Retries**: só para falhas transitórias (rede, timeout, 5xx), até 2 vezes com backoff exponencial (800 ms, 1,6 s). 4xx nunca é repetido. Mutations não repetem automaticamente.
- **Respostas obsoletas**: o `AbortSignal` do Query é repassado ao Axios — trocar filtros cancela a requisição anterior; como a chave inclui todos os parâmetros, uma resposta atrasada nunca sobrescreve outra consulta. Listagem usa `keepPreviousData` (resultado anterior esmaecido + "Atualizando…").
- **Isolamento**: dados privados em `['user', userId, …]`; carrinho em `['cart', dono]`. Logout/troca de usuário cancela e remove essas chaves, limpa avisos e recria o socket.
- **Invalidação**: mutations do carrinho gravam a resposta da API no cache; perfil atualiza cache + sessão; carteiras atualizam a lista e revalidam; pedido confirmado invalida o carrinho.
- **Otimista com rollback**: favoritos (`useToggleFavorite`) — snapshot em `onMutate`, restauração em `onError`, reconciliação em `onSettled`.

## Sessão

Token + usuário persistidos em `localStorage` (`nftmkt:session`) e revalidados com `GET /auth/session` antes do primeiro render. Qualquer 401 para o token vigente encerra a sessão (`endedBy: 'expired'`), exibe aviso e reavalia os guards: numa rota privada o usuário vai para o login e volta ao mesmo endereço. Durante o checkout, o rascunho do formulário, a carteira conectada e a tentativa de envio ficam em `sessionStorage` por usuário — após relogar, tudo é retomado. Logout limpa esses rascunhos. Logins em outra aba são sincronizados (evento `storage`).

## Carrinho

O carrinho vive no servidor simulado (persistente após refresh). Visitantes usam `X-Cart-Id`; ao autenticar, o carrinho do visitante é mesclado ao do usuário (limitado ao estoque) e o id descartado. O resumo (subtotal, desconto, taxa, total) sempre vem da API; o cliente só formata. Linhas com preço alterado são sinalizadas até o usuário confirmar ("Entendi"); linhas esgotadas/insuficientes bloqueiam o checkout.

## Checkout, idempotência e recuperação

1. Dados validados (zod + react-hook-form, erros associados aos campos) e carteira conectada (simulação com aprovação/recusa/desconexão).
2. "Revisar pedido" cria uma **cotação** no servidor; a revisão mostra exclusivamente os valores dela.
3. Durante a revisão, `nft.updated` de um item da cotação ou uma reconexão marcam a cotação como desatualizada e bloqueiam a confirmação até "Atualizar cotação".
4. Confirmar gera uma `Idempotency-Key` por cotação, persistida antes do envio. Timeout/rede/5xx → reenvio automático (1×) com a mesma chave; depois "Tentar novamente" (mesma chave). Cliques repetidos são ignorados enquanto há envio. Refresh durante o envio → a tentativa salva é retomada ao reabrir o checkout.
5. `409 QUOTE_STALE`/`AVAILABILITY_CONFLICT` → a nova cotação substitui a anterior e o usuário precisa confirmar novamente.
6. O pedido abre em `/pedidos/$id` (pendente → confirmado/recusado). A confirmação só aparece com `status = confirmed` vindo da simulação; o recibo é o snapshot do pedido (alterações posteriores no catálogo não o afetam).

## Tempo real e reconciliação REST × Socket.IO

- **Transporte**: `socket.io-client` com `transports: ['websocket']`. Com mocks, o MSW intercepta o `WebSocket` e o [`@mswjs/socket.io-binding`](https://github.com/mswjs/socket.io-binding) codifica o protocolo Engine.IO/Socket.IO (`src/mocks/realtime.ts`). O `socket.io-client` é importado depois que o MSW inicia, porque o `engine.io-client` captura `globalThis.WebSocket` no carregamento do módulo.
- **Limitações do transporte simulado**: sem long-polling (só WebSocket), sem namespaces/rooms/acks; o handshake é sintetizado pelo binding; o heartbeat (ping) é enviado pelo mock a cada 20 s. O MSW remove o prefixo `/socket.io/` da URL antes do match, por isso o handler usa apenas a origem.
- **Ordenação/duplicatas**: `EventGate` (por conexão) descarta `eventId` já vistos e versões antigas; além disso cada aplicação compara com a `version` em cache — estado mais novo nunca regride, efeitos (avisos/toasts) não se repetem.
- **Isolamento**: o servidor só envia `order.updated` ao dono; o cliente também confere `userId`. Trocar de usuário encerra o socket anterior e remove seus listeners.
- **Reconexão**: no `connect` subsequente, o cliente invalida catálogo, detalhe, carrinho e pedidos ativos (refetch via REST). Pedidos pendentes também têm um polling de segurança de 20 s.
- **Mesma fonte**: toda mudança passa pelo banco simulado, que persiste e emite o evento correspondente — REST e Socket.IO nunca divergem.

## Mocks (MSW)

- Handlers REST na camada de rede (Service Worker) e servidor Socket.IO via interceptação de WebSocket, ativados por `VITE_ENABLE_MOCKS` e presentes no build de demonstração.
- Estado único (`src/mocks/db.ts`) com catálogo, usuários, sessões, favoritos, carrinhos, cotações, pedidos, chaves de idempotência e carteiras; persistido em `localStorage` (`nftmkt:mock-db:v1`) para sustentar refresh. Reset restaura o seed.
- Fixtures determinísticas: 48 NFTs, 6 coleções, 6 categorias, 1–3 edições com estoques/limites variados (todo 7º esgotado, todo 5º com uma edição esgotada), 3 usuários.
- Latência e falhas por cenário (seção acima); timers usam `setTimeout`/`Date`, controláveis com `page.clock` no Playwright.

## Testes (Playwright)

Executam contra o build de demonstração (`webServer` com `VITE_HTTP_TIMEOUT_MS=4000` para acelerar o cenário de timeout) em Chromium desktop (1440×900) e mobile (390×844). Cada teste usa um contexto novo — `localStorage` vazio, logo o banco simulado começa no seed. Cenários são escolhidos antes do carregamento; eventos são disparados por `window.__mock` (que passa pelo banco simulado e pelo socket). Relatório HTML em `playwright-report/`, traces mantidos em falhas, baselines visuais versionados em `e2e/__screenshots__/{desktop,mobile}`.

| Arquivo | Cobertura (item do enunciado) |
| --- | --- |
| `01-catalog` | 1 — busca, filtros combinados, ordenação, paginação, histórico/refresh, respostas fora de ordem, vazio |
| `02-detail` | 2 — acesso direto, galeria, edição esgotada, limite, inexistente, rota 404 |
| `03-auth` | 3 — cadastro/conflito, login/retorno, expiração (API e relógio), logout e troca de usuário |
| `04-favorites` | 4 — persistência, falha com rollback |
| `05-cart` | 5 — quantidades, remoção, cupons, refresh, merge no login |
| `06-purchase` | 6 — compra completa até o recibo (snapshot) |
| `07-payment-failures` | 7 — recusa, cliques repetidos, timeout e refresh com o mesmo pedido |
| `08-account` | 8 — perfil, avatar, senha, carteiras com erros de validação/API |
| `09-realtime-checkout` | 9 — preço/estoque via Socket.IO no checkout e no carrinho, revalidação no servidor |
| `10-realtime-resilience` | 10 — duplicados, antigos, queda de conexão com pedido pendente, refresh |
| `11-accessibility` | 11 — teclado, skip link, foco em drawers, erros associados, axe (WCAG A/AA) |
| `12-loading-errors` | 12 — skeletons, falha transitória + nova tentativa, offline, 500 |
| `visual` | Regressão visual: início, detalhe, carrinho, pagamento (+ revisão) |

## Acessibilidade

Skip link, foco movido para o `h1` a cada navegação, foco preso e devolvido em dialogs/drawers (Radix), labels e `aria-describedby` em todos os campos, `aria-invalid`, mensagens com `role="alert"`, avisos de tempo real e mutations via regiões `aria-live`/toasts, estados indicados por texto (não só cor), skeletons com `aria-busy`, `prefers-reduced-motion` desativa shimmer e animações.

## Desvios do layout e substituições

- **Figma não acessível pela ferramenta usada** (sem permissão de edição para leitura via API). A identidade segue o template público "NFT Marketplace" que serve de base ao arquivo: fundo #2B2B2B, superfícies #3B3B3B, roxo #A259FF, Work Sans + Space Mono, cantos de 20 px, cards 330×(295+) e hero em duas colunas. Os tokens estão centralizados em `src/styles/index.css` para ajuste fino quando o arquivo puder ser inspecionado.
- **Assets**: a arte dos NFTs e avatares são SVGs gerados deterministicamente (`scripts/generate-assets.mjs`); fontes via `@fontsource` (locais, sem CDN).
- **Contraste**: botões preenchidos usam #9142F5 (branco 4,88:1) em vez de #A259FF (3,88:1); textos roxos sobre fundo escuro usam #C08CFF; legendas usam #B3B3B2 em vez de #858584 — todos para atingir WCAG AA.
- **Selects do catálogo** (ordenação e coleção) são nativos, com o visual do shadcn: melhor no mobile e menos JavaScript no caminho crítico. Os demais selects usam o componente shadcn.
- **Fora do escopo** (rankings, newsletter): visíveis, marcados "(em breve)" ou com mensagem explícita de indisponibilidade — nada aparenta sucesso. O link do explorador de blocos é exibido como texto (simulado).

## Performance (Lighthouse)

Mediana de 3 execuções (detalhes em `lighthouse/SUMMARY.md`): todas as categorias atingem as metas — Accessibility, Best Practices e SEO em 100; Performance 99–100 no desktop e 90–93 no mobile.

Análise do perfil mobile (o mais justo, ~90 no início):

- **LCP ≈ 3 s**: cadeia crítica `index.js → MSW (Service Worker + handlers) → bundle da app → GET /nfts/highlights → imagem do destaque`. O MSW precisa iniciar antes das requisições, e a latência simulada da API (120–350 ms) também entra na conta. Medido: baixar MSW e app em paralelo **piorou** o LCP (3,8 s) por disputa de banda no 4G simulado; a ordem sequencial foi mantida.
- **TBT 80–240 ms** (variação entre execuções): avaliação do bundle MSW + app e primeiro render do catálogo. Mitigações aplicadas: rotas fora do início com lazy loading, `socket.io-client`, menu da conta e painel de mocks sob demanda, selects nativos no catálogo.
- **CLS ≈ 0,02**: skeletons com as mesmas dimensões do conteúdo; imagens com `width/height`.
- Um *app shell* estático (fundo + cabeçalho no `index.html`) antecipa o FCP. Nenhuma funcionalidade, imagem ou fonte foi removida para a auditoria; com um backend real (sem MSW no caminho crítico) o LCP mobile cairia ~1 s.

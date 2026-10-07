# NFT Marketplace

Marketplace de NFTs em React + TypeScript com descoberta, carrinho, checkout e conta do colecionador. A API REST e o Socket.IO são simulados com MSW, que fica ativo também no build publicado.

- **Aplicação publicada:** _<URL do deploy>_
- **Repositório:** https://github.com/josefernando106/frontend-challenge-jungle

| Documento | Conteúdo |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Organização, sessão, carrinho, cache, reconciliação REST × Socket.IO, limitações, decisões de UX e desvios do Figma |
| [docs/API.md](docs/API.md) | Contratos REST, formato de erros e eventos Socket.IO |
| [lighthouse/SUMMARY.md](lighthouse/SUMMARY.md) | Medianas da auditoria Lighthouse, ambiente e condições |

**Stack:** React 19, TypeScript, Vite, TanStack Router, TanStack Query, Axios, Socket.IO client, Tailwind CSS 4, shadcn/ui, MSW (+ `@mswjs/socket.io-binding`), Playwright e Lighthouse.

## Setup

Requisitos: **Node.js ≥ 20** e npm. Nenhum backend ou serviço privado é necessário.

```bash
git clone https://github.com/josefernando106/frontend-challenge-jungle.git
cd frontend-challenge-jungle
npm ci                              # instala exatamente o que está no package-lock.json
npx playwright install chromium     # só para testes E2E e Lighthouse (uma vez)
npm run dev                         # http://localhost:5173 com mocks ativos
```

## Variáveis de ambiente

Os valores ficam versionados em `.env.mocks`, carregado pelo modo `mocks` (`npm run dev`, `npm run build`). O `.env.example` traz o mesmo conjunto documentado. Não é preciso criar `.env`.

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `VITE_ENABLE_MOCKS` | `true` | Liga a camada MSW (REST + Socket.IO). Obrigatória: não há backend real |
| `VITE_API_BASE_URL` | `/api` | Base das chamadas REST feitas pelo Axios |
| `VITE_SOCKET_URL` | `wss://realtime.nft-market.mock` | Endpoint do Socket.IO. Com mocks ativos, é interceptado pelo MSW e nenhuma conexão real é aberta |
| `VITE_HTTP_TIMEOUT_MS` | `8000` | Timeout das requisições HTTP (os testes E2E usam `4000`) |

## Credenciais fictícias

A senha é **`Senha@123`** para todas as contas. No banco simulado só ficam hashes, nunca a senha em claro.

| E-mail | Perfil do seed |
| --- | --- |
| `ana@nft.dev` | 2 carteiras (principal e secundária), 2 favoritos |
| `bruno@nft.dev` | 1 carteira |
| `carla@nft.dev` | Sem carteiras (para testar o cadastro de carteira no checkout) |

Cupons: `JUNGLE10` (10%) e `BEMVINDO5` (5%) são válidos. `EXPIRADO20` está expirado. Qualquer outro código é inválido.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` (ou `npm run dev:mocks`) | Desenvolvimento com mocks em http://localhost:5173 |
| `npm run build` | Checagem de tipos + build otimizado de demonstração (mocks ativos) em `dist/` |
| `npm run preview` | Serve o `dist/` em http://localhost:4173 |
| `npm run typecheck` | Verificação de tipos (TypeScript strict) |
| `npm run lint` | ESLint |
| `npm run test:e2e` | Playwright em Chromium desktop (1440) e mobile (390). Faz build e preview sozinho |
| `npm run test:e2e:report` | Abre o relatório HTML (`playwright-report/`), com traces das falhas |
| `npm run test:e2e:update` | Regera as baselines visuais em `e2e/__screenshots__/` |
| `npm run lighthouse` | Build + auditoria de início e detalhe, 3× por perfil (mobile/desktop), com mediana |
| `npm run lighthouse -- --skip-build` | Auditoria reaproveitando o `dist/` existente |
| `npm run assets` | Regera a arte SVG dos NFTs e avatares em `public/assets` |

A auditoria grava os relatórios HTML/JSON em `lighthouse/reports/` e o resumo em `lighthouse/summary.json` e `lighthouse/SUMMARY.md`. A configuração versionada fica em `lighthouse/audit.config.mjs`.

## Cenários de simulação

### Seleção

Há três formas de escolher um cenário. Ele fica salvo e sobrevive a refresh:

1. **Pela URL:** acrescente `?scenario=<id>` a qualquer rota, por exemplo `/?scenario=slow` ou `/checkout?scenario=payment-declined`. O parâmetro some da URL depois de aplicado.
2. **Pelo painel Mocks:** botão "Mocks: &lt;cenário&gt;" no canto inferior esquerdo (no mobile, no topo à direita).
3. **Pelo console:** `window.__mock.setScenario('slow')`. Para listar os ids, use `window.__mock.scenarios()`.

### Reset

Qualquer uma das opções abaixo restaura o seed (catálogo, usuários, carrinhos, favoritos, carteiras e pedidos), volta ao cenário `default` e limpa sessão e cache locais:

- `?mockReset=1` na URL (pode ser combinado: `/?mockReset=1&scenario=slow`);
- botão **"Resetar tudo"** no painel Mocks;
- `window.__mock.reset()` no console.

### Cenários disponíveis

| id | Efeito |
| --- | --- |
| `default` | Sucesso, latência de 120–350 ms |
| `slow` | Latência fixa de 2,5 s (skeletons) |
| `variable-latency` | Latência de 150 ms a 2 s, pseudoaleatória com seed fixa (reprodutível) |
| `out-of-order` | Consultas do catálogo alternam 1,5 s e 150 ms, então a resposta antiga chega depois da nova |
| `empty` | Catálogo sem resultados |
| `offline` | REST com erro de rede e Socket.IO recusado |
| `server-error` | 500 em catálogo, detalhe e carrinho |
| `transient-error` | As 3 primeiras leituras de catálogo/detalhe retornam 503; depois a API recupera |
| `session-expired` | Sessões expiram 20 s após o login |
| `favorites-failure` | Incluir/remover favorito retorna 500 (rollback da atualização otimista) |
| `price-change` | O preço do 1º item do carrinho sobe 15% no momento da confirmação |
| `sold-out` | A edição do 1º item esgota no momento da confirmação |
| `order-timeout` | O pedido é criado, mas a 1ª resposta excede o timeout; a nova tentativa recupera o mesmo pedido |
| `payment-declined` | A liquidação do pagamento é recusada |
| `wallet-rejected` | A carteira recusa a conexão |

### Ações do painel Mocks / `window.__mock`

Todas as ações alteram o banco simulado e chegam à interface pelas respostas REST e pelos eventos Socket.IO. Nenhuma mexe direto na UI ou no cache.

| Ação (painel) | Console | Efeito |
| --- | --- | --- |
| Catálogo em tempo real → Aplicar | `updateNft('nft-001', { priceEth: '1.25', available: 0 })` | Altera preço/estoque da 1ª edição (ou de `editionId`) e emite `nft.updated` |
| Reenviar último evento | `replayLastEvent()` | Reenvia o último evento (duplicata) |
| Reenviar evento antigo | `replayStaleEvent()` | Reenvia um evento com versão antiga |
| Derrubar socket (5 s) | `disconnectSockets({ block: true })` / `unblockSockets()` | Derruba e bloqueia o socket até liberar a reconexão |
| Expirar sessões | `expireSessions()` | Invalida todas as sessões ativas |
| Liquidar pedidos | `settleOrders()` | Liquida imediatamente os pedidos pendentes |
| — | `snapshot()` | Cópia do banco simulado, para inspeção |

## Como reproduzir os fluxos de falha

Antes de cada roteiro, comece com `/?mockReset=1` e entre com `ana@nft.dev` / `Senha@123` quando for preciso.

| Fluxo | Passos | Resultado esperado |
| --- | --- | --- |
| Carregamento lento | Abra `/?scenario=slow` e navegue entre catálogo, detalhe e carrinho | Skeletons com shimmer, sem deslocamento de layout |
| Respostas fora de ordem | `/?scenario=out-of-order`, digite rápido na busca ou troque filtros em sequência | Só o resultado da consulta mais recente aparece |
| Falha e nova tentativa | `/?scenario=transient-error`, abra o catálogo e use "Tentar novamente" | Erro com retry; a API recupera depois das 3 falhas |
| Erro 500 | `/?scenario=server-error` | Estado de erro em catálogo, detalhe e carrinho |
| Sem conexão | `/?scenario=offline` | Erro de rede no REST e indicador do cabeçalho em "Reconectando tempo real…" |
| Resultado vazio | `/?scenario=empty`, ou uma busca sem correspondência no `default` | Estado vazio |
| NFT inexistente / rota inexistente | Abra `/nft/nao-existe` e `/qualquer-coisa` | Página de recurso não encontrado e 404 |
| Conflito de cadastro | Em `/cadastro`, use o e-mail `ana@nft.dev` | Erro de conflito associado ao campo de e-mail |
| Sessão expirada | `/?scenario=session-expired`, faça login e espere 20 s (ou use "Expirar sessões"). Depois navegue ou confirme o checkout | Redireciona ao login preservando o contexto e retoma o fluxo após autenticar |
| Falha em favoritos | `/?scenario=favorites-failure`, autenticado, favorite um NFT | Atualização otimista revertida, com aviso |
| Cupom inválido / expirado | No carrinho, aplique `XYZ` e depois `EXPIRADO20` | Mensagem de erro correspondente; o resumo não muda |
| Preço alterado no checkout | `/?scenario=price-change`, adicione um NFT, vá ao checkout e confirme | Compra bloqueada até o usuário aceitar a nova cotação |
| Edição esgotada no checkout | `/?scenario=sold-out`, mesmo roteiro | Conflito de disponibilidade; os itens são preservados |
| Alteração em tempo real | Com um NFT no carrinho ou no checkout, use "Catálogo em tempo real" no painel para mudar preço ou estoque | Aviso acessível, resumo atualizado e confirmação com cotação desatualizada impedida |
| Eventos duplicados ou antigos | Depois de uma alteração, use "Reenviar último evento" e "Reenviar evento antigo" | Nada regride nem é reaplicado |
| Timeout do pedido | `/?scenario=order-timeout`, finalize a compra | Após o timeout, a nova tentativa recupera o **mesmo** pedido (idempotência), sem duplicar |
| Clique repetido | Clique várias vezes em confirmar a compra | Um único pedido criado |
| Pagamento recusado | `/?scenario=payment-declined`, finalize a compra | Pedido recusado (terminal); os itens continuam no carrinho |
| Carteira recusa conexão | `/?scenario=wallet-rejected`, conecte a carteira no checkout | Erro de conexão, com opção de tentar novamente |
| Queda de conexão com pedido pendente | Com o pedido pendente, use "Derrubar socket (5 s)" ou recarregue a página | Ao reconectar ou recarregar, o estado do pedido é recuperado sem nova compra |

A maioria desses roteiros também está automatizada em `e2e/` (arquivos `01` a `12` seguem a ordem dos itens de teste do desafio, e `visual.spec.ts` faz a regressão visual).

## Deploy

O build publicado é o mesmo de `npm run build` (mocks ativos). O MSW roda no navegador via Service Worker (`public/mockServiceWorker.js`), então a aplicação publicada não depende de nenhum servidor além da hospedagem estática.

- **Vercel (recomendado):** importe o repositório. O `vercel.json` já define o build (`npm run build`), a saída (`dist`) e o rewrite das rotas para `index.html`, para que acesso direto e refresh funcionem em qualquer rota.
- **Netlify / Cloudflare Pages:** build `npm run build`, diretório `dist`. O fallback de rotas vem de `public/_redirects`.

Para conferir localmente o que vai ao ar: `npm run build && npm run preview`, depois abra e recarregue uma rota interna, como http://localhost:4173/nft/nft-002.

## Estrutura

```
src/
  api/         cliente Axios, endpoints e query keys
  contracts/   tipos compartilhados entre transporte, estado e UI
  features/    auth, catalog, cart, checkout, orders, favorites, account
  realtime/    cliente Socket.IO e reconciliação com o cache
  mocks/       handlers MSW, banco simulado, fixtures, cenários e painel
  pages/ routes/ components/ lib/ styles/
e2e/           testes Playwright e baselines visuais
lighthouse/    configuração, relatórios e resumo da auditoria
scripts/       auditoria Lighthouse e geração de assets
```

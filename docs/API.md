# Contratos REST e eventos

Tipos fonte da verdade: [`src/contracts/index.ts`](../src/contracts/index.ts) — usados pelo cliente (Axios/Query/UI) **e** pelos handlers MSW.

Convenções:

- Base: `VITE_API_BASE_URL` (padrão `/api`). JSON em todas as rotas.
- Autenticação: `Authorization: Bearer <token>`. Visitantes identificam o carrinho com `X-Cart-Id: guest-<uuid>`.
- Valores em ETH são **strings decimais** (`"0.125"`), calculados em ponto fixo (wei, `BigInt`) — `src/lib/eth.ts`. Quantidades são inteiros.
- Datas em ISO-8601.

## Erros

Todas as falhas usam o envelope:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Verifique os campos.", "fieldErrors": { "email": "E-mail inválido." }, "details": {} } }
```

| HTTP | `code` | Quando |
| ---: | --- | --- |
| 422 | `VALIDATION_ERROR` | Campos inválidos (`fieldErrors` por campo; no pedido, `buyer.<campo>`) |
| 422 | `COUPON_INVALID` / `COUPON_EXPIRED` | Cupom inexistente / vencido |
| 401 | `INVALID_CREDENTIALS` | Login incorreto |
| 401 | `UNAUTHENTICATED` | Sem token ou token desconhecido |
| 401 | `SESSION_EXPIRED` | Token expirado (o cliente encerra a sessão e redireciona preservando o contexto) |
| 403 | `FORBIDDEN` / `WALLET_REJECTED` | Sem permissão / conexão recusada na carteira |
| 404 | `NOT_FOUND` | Recurso inexistente (pedido de outro usuário também responde 404) |
| 409 | `CONFLICT` | E-mail/username/endereço já usados, papel de carteira ocupado |
| 409 | `AVAILABILITY_CONFLICT` | Quantidade acima do estoque/limite (`details.available`) |
| 409 | `QUOTE_STALE` | Cotação divergente da atual (`details.quote` traz a nova cotação) |
| 409 | `IDEMPOTENCY_CONFLICT` | `Idempotency-Key` reutilizada com outro conteúdo |
| 500 / 503 | `INTERNAL_ERROR` / `SERVICE_UNAVAILABLE` | Falha do servidor / transitória (`Retry-After`) |

Falhas de transporte viram `ApiError` no cliente com `code` `NETWORK_ERROR`, `TIMEOUT` ou `CANCELED`.

## Sessão e conta

| Método | Rota | Corpo | Resposta |
| --- | --- | --- | --- |
| POST | `/auth/register` | `{ name, email, password }` | `201 Session` · 409 e-mail em uso |
| POST | `/auth/login` | `{ email, password }` | `200 Session` · 401 `INVALID_CREDENTIALS` |
| GET | `/auth/session` | — | `{ user, expiresAt }` · 401 |
| POST | `/auth/logout` | — | `204` (revoga o token) |

`Session = { token, user: User, expiresAt }`. Senhas: mín. 8 caracteres com letras e números; armazenadas como `SHA-256(salt:senha)`.

## Catálogo

| Método | Rota | Parâmetros / resposta |
| --- | --- | --- |
| GET | `/nfts` | `q`, `category` (repetível), `collection`, `minPrice`, `maxPrice`, `status=all\|available\|soldout`, `sort=recent\|price_asc\|price_desc\|popular\|name`, `page`, `pageSize` → `Paginated<NftSummary>` |
| GET | `/nfts/highlights` | `NftSummary[]` |
| GET | `/catalog/facets` | `{ categories[], collections[], priceRange }` (com contagens) |
| GET | `/nfts/:id` | `Nft` (galeria, edições com preço/estoque/limite, `version`) · 404 |

Busca ignora acentos e caixa (nome, artista, coleção). Filtros são combináveis (AND entre grupos, OR entre categorias). Ordenação estável (desempate por id).

## Favoritos (autenticado)

| Método | Rota | Resposta |
| --- | --- | --- |
| GET | `/favorites` | `{ nftIds: string[] }` |
| PUT | `/favorites/:nftId` | `{ nftIds }` (idempotente) |
| DELETE | `/favorites/:nftId` | `{ nftIds }` |

## Carrinho

Dono: usuário autenticado ou `X-Cart-Id`. Toda mutation devolve o `Cart` recalculado pela API.

| Método | Rota | Corpo |
| --- | --- | --- |
| GET | `/cart` | — |
| POST | `/cart/items` | `{ nftId, editionId, quantity }` (soma à linha existente; valida estoque e `maxPerOrder`) |
| PATCH | `/cart/items/:lineId` | `{ quantity }` |
| DELETE | `/cart/items/:lineId` | — |
| PUT / DELETE | `/cart/coupon` | `{ code }` |
| POST | `/cart/acknowledge` | — (usuário ciente dos novos preços) |
| POST | `/cart/merge` | `{ guestCartId }` (autenticado; mescla respeitando limites) |

`CartLine.status`: `ok`, `price_changed` (preço atual ≠ preço visto), `insufficient`, `unavailable`. `summary = { subtotalEth, discountEth, networkFeeEth, totalEth }` (taxa estimada em Ethereum).

Cupons de teste: `JUNGLE10` (10%), `BEMVINDO5` (5%), `EXPIRADO20` (expirado).

## Cotação e pedidos (autenticado)

| Método | Rota | Corpo / cabeçalhos | Resposta |
| --- | --- | --- | --- |
| POST | `/quotes` | `{ network }` | `201 Quote` (válida por 10 min, com `issues`) |
| POST | `/orders` | `Idempotency-Key: <uuid>` + `{ quoteId, walletId, network, buyer }` | `201 Order` · `200` + `Idempotent-Replayed: true` na repetição |
| GET | `/orders?status=pending` | — | `Order[]` do usuário |
| GET | `/orders/:id` | — | `Order` (snapshot imutável) |

Criação do pedido:

1. Mesma chave + mesmo corpo → devolve o mesmo pedido (sem duplicar). Mesma chave + corpo diferente → `409 IDEMPOTENCY_CONFLICT`.
2. Revalida preço, disponibilidade, cupom e taxa recalculando a cotação. Divergência ou cotação vencida → `409 QUOTE_STALE` com a nova cotação; itens indisponíveis → `409 AVAILABILITY_CONFLICT`.
3. Reserva o estoque e cria o pedido `pending` com snapshot dos itens e valores.
4. Após `settleDelayMs` o pedido é liquidado: `confirmed` (remove do carrinho **apenas** os itens/quantidades comprados) ou `declined` (libera o estoque; carrinho intacto). Estados terminais não mudam.

`Network fee`: Ethereum 0,0021 + 0,0003/linha extra · Polygon 0,00012 + 0,00002 · Arbitrum 0,0004 + 0,00005.

## Perfil e carteiras (autenticado)

| Método | Rota | Corpo |
| --- | --- | --- |
| GET / PATCH | `/profile` | `{ name, username, email, bio }` (409 se e-mail/username em uso) |
| POST | `/profile/avatar` | `{ dataUrl }` PNG/JPEG/WEBP ≤ 1 MB |
| POST | `/profile/password` | `{ currentPassword, newPassword }` → `204`; encerra as demais sessões |
| GET / POST | `/wallets` | `{ label, provider, address, role: primary\|secondary, networks[] }` |
| PATCH | `/wallets/:id` | idem |
| POST | `/wallets/:id/connect` | `{ network }` → `WalletConnection` · 403 `WALLET_REJECTED` |

## Eventos Socket.IO

Conexão: `io(VITE_SOCKET_URL, { transports: ['websocket'], auth: { token } })`. O servidor associa a conexão ao usuário pelo token do pacote `CONNECT`.

Envelope comum:

```ts
{
  eventId: string            // identidade estável (deduplicação)
  type: 'nft.updated' | 'order.updated'
  resource: { type: 'nft' | 'order', id: string }
  version: number            // versão do recurso após a mudança (monotônica)
  occurredAt: string
  userId?: string            // dono (somente order.updated)
  data: ...
}
```

| Evento | Destino | `data` |
| --- | --- | --- |
| `nft.updated` | todos os clientes | `{ nftId, name, editions: [{ id, label, priceEth, available }], fromPriceEth, available }` |
| `order.updated` | apenas conexões do dono | `{ order: Order }` |

Regras do cliente (`src/realtime`): descarta `eventId` repetido e versões ≤ à última aplicada (por recurso e também comparando com a `version` em cache); ignora `order.updated` de outro usuário; estados terminais de pedido não regridem; ao reconectar, invalida catálogo, detalhe, carrinho e pedidos ativos para reconciliar via REST.

import type { CategoryId, Collection, Creator, Nft, NftEdition, Wallet } from '@/contracts'
import { CATEGORIES } from '@/contracts'

/**
 * Fixtures determinísticas. Nada aqui usa Math.random/Date.now: o mesmo seed sempre
 * produz o mesmo catálogo, o que mantém testes e baselines visuais estáveis.
 */

export const FIXTURE_EPOCH = Date.UTC(2026, 0, 15, 12, 0, 0)

export interface UserRecord {
  id: string
  name: string
  username: string
  email: string
  bio: string
  avatarUrl: string
  passwordHash: string
  salt: string
}

/** Credenciais fictícias (todas com a senha "Senha@123"). */
export const SEED_USERS: UserRecord[] = [
  {
    id: 'usr-ana',
    name: 'Ana Colecionadora',
    username: 'ana.colecionadora',
    email: 'ana@nft.dev',
    bio: 'Coleciono arte generativa desde 2021.',
    avatarUrl: '/assets/avatars/user-01.svg',
    salt: 's4lt-ana-01',
    passwordHash: 'b436fe1c1faa31ae05bd0922d912cb9b83f2b708217b9d5182300b0044aa08c7',
  },
  {
    id: 'usr-bruno',
    name: 'Bruno Pixel',
    username: 'bruno.pixel',
    email: 'bruno@nft.dev',
    bio: 'Gamer e caçador de edições raras.',
    avatarUrl: '/assets/avatars/user-02.svg',
    salt: 's4lt-bruno-02',
    passwordHash: 'd999ebf19a2f42b05757c8313bb29e81e5068643d5e7428cb6bc0d7507b01216',
  },
  {
    id: 'usr-carla',
    name: 'Carla Nova',
    username: 'carla.nova',
    email: 'carla@nft.dev',
    bio: '',
    avatarUrl: '/assets/avatars/user-03.svg',
    salt: 's4lt-carla-03',
    passwordHash: '6f810d0eaa4066e01cc16d810058e91546d88d01b46807fafd646c06f9da59b6',
  },
]

export const SEED_WALLETS: Record<string, Wallet[]> = {
  'usr-ana': [
    {
      id: 'wal-ana-1',
      label: 'MetaMask principal',
      provider: 'metamask',
      address: '0x7a3B9c1D2e4F5a6B7c8D9e0F1a2B3c4D5e6F7a8B',
      role: 'primary',
      networks: ['ethereum', 'polygon', 'arbitrum'],
      updatedAt: new Date(FIXTURE_EPOCH).toISOString(),
    },
    {
      id: 'wal-ana-2',
      label: 'Coinbase reserva',
      provider: 'coinbase',
      address: '0x1F2e3D4c5B6a79880A1b2C3d4E5f60718293a4B5',
      role: 'secondary',
      networks: ['ethereum', 'polygon'],
      updatedAt: new Date(FIXTURE_EPOCH).toISOString(),
    },
  ],
  'usr-bruno': [
    {
      id: 'wal-bruno-1',
      label: 'WalletConnect',
      provider: 'walletconnect',
      address: '0x9C8b7A6f5E4d3C2b1A0f9E8d7C6b5A4f3E2d1C0b',
      role: 'primary',
      networks: ['ethereum', 'arbitrum'],
      updatedAt: new Date(FIXTURE_EPOCH).toISOString(),
    },
  ],
}

export const SEED_FAVORITES: Record<string, string[]> = {
  'usr-ana': ['nft-002', 'nft-005'],
  'usr-bruno': ['nft-010'],
}

export interface CouponRecord {
  code: string
  percentOff: number
  description: string
  expiresAt: string
}

export const COUPONS: CouponRecord[] = [
  { code: 'JUNGLE10', percentOff: 10, description: '10% de desconto', expiresAt: '2099-12-31T23:59:59.000Z' },
  { code: 'BEMVINDO5', percentOff: 5, description: '5% de boas-vindas', expiresAt: '2099-12-31T23:59:59.000Z' },
  { code: 'EXPIRADO20', percentOff: 20, description: '20% (campanha encerrada)', expiresAt: '2025-01-01T00:00:00.000Z' },
]

export const CREATORS: Creator[] = [
  'Moonbeam',
  'Animakid',
  'Keepitreal',
  'Nebula Kid',
  'Lúcia Vetor',
  'Orbitian',
  'Pixel Sertão',
  'Rafa Glitch',
  'Mar de Néon',
  'Caju Studio',
  'Iara Luz',
  'Zé Polígono',
].map((name, i) => ({
  id: `art-${String(i + 1).padStart(2, '0')}`,
  name,
  avatarUrl: `/assets/avatars/artist-${String(i + 1).padStart(2, '0')}.svg`,
}))

export const COLLECTIONS: Collection[] = [
  { id: 'col-cosmos', name: 'Cosmos Digital' },
  { id: 'col-neon', name: 'Neon Tropical' },
  { id: 'col-sonora', name: 'Ondas Sonoras' },
  { id: 'col-retina', name: 'Retina' },
  { id: 'col-arcade', name: 'Arcade 2099' },
  { id: 'col-chave', name: 'Chaves de Acesso' },
]

const NAMES = [
  'Galáxia Distante',
  'Sonho Neon',
  'Mente Cristalina',
  'Astro Fiction',
  'Cripto Cidade',
  'Coração de Vidro',
  'Eco Orbital',
  'Floresta Binária',
  'Maré Lunar',
  'Pulso Violeta',
  'Ruído Branco',
  'Sinal Perdido',
  'Tempestade Solar',
  'Ultravioleta',
  'Vórtice',
  'Aurora Austral',
  'Baile Quântico',
  'Cometa Azul',
  'Deriva',
  'Espiral Dourada',
  'Fóton',
  'Gravidade Zero',
  'Horizonte',
  'Ilha Flutuante',
  'Jardim Sintético',
  'Kaleidos',
  'Luz Fantasma',
  'Magma',
  'Nébula Rosa',
  'Oásis Digital',
  'Prisma',
  'Quasar',
  'Ressonância',
  'Silêncio Elétrico',
  'Trópico Glitch',
  'Uivo Cósmico',
  'Vapor',
  'Wavelength',
  'Xadrez Astral',
  'Yara',
  'Zênite',
  'Abismo Lilás',
  'Brisa Robótica',
  'Circuito',
  'Dínamo',
  'Estática',
  'Fractal',
  'Geodo',
]

const PRICES = ['0.08', '0.12', '0.25', '0.33', '0.42', '0.5', '0.75', '0.99', '1.2', '1.5', '2.25', '3.1', '0.059', '0.1875']

const CATEGORY_BY_COLLECTION: Record<string, CategoryId> = {
  'col-cosmos': 'art',
  'col-neon': 'art',
  'col-sonora': 'music',
  'col-retina': 'photography',
  'col-arcade': 'gaming',
  'col-chave': 'utility',
}

const EDITION_LABELS = ['Genesis', 'Ouro', 'Aberta']

function editionsFor(n: number): NftEdition[] {
  const count = 1 + (n % 3)
  const base = PRICES[n % PRICES.length]
  const result: NftEdition[] = []
  for (let e = 0; e < count; e++) {
    const supply = [10, 25, 100][e]
    // Esgotamentos determinísticos: todo 7º NFT esgotado; todo 5º com a 2ª edição esgotada.
    let available = Math.max(1, (supply - ((n * 3 + e * 5) % supply)) % 12)
    if (n % 7 === 0) available = 0
    if (n % 5 === 0 && e === 1) available = 0
    const price =
      e === 0 ? base : e === 1 ? multiplyDecimal(base, 3) : multiplyDecimal(base, 0.5)
    result.push({
      id: `nft-${pad(n)}-ed${e + 1}`,
      label: `Edição ${EDITION_LABELS[e]}`,
      priceEth: price,
      available,
      supply,
      maxPerOrder: e === 0 ? 2 : 5,
    })
  }
  return result
}

function multiplyDecimal(value: string, factor: number): string {
  // Fixtures apenas: valores pequenos e exatos o suficiente com 4 casas.
  return String(Math.round(Number(value) * factor * 10000) / 10000)
}

const pad = (n: number) => String(n).padStart(3, '0')

/** Artes do layout (public/assets/monkeys), em WEBP 960px; há variante de 480px para os cards. */
const ARTWORKS = [
  { file: 'home-monkey', alt: 'macaco de óculos redondos e jaqueta college verde' },
  { file: 'monkey-fone', alt: 'macaco dourado com fones de ouvido verdes' },
  { file: 'monkey-hat', alt: 'macaco grisalho de chapéu bucket e moletom lilás' },
  { file: 'monkey-terno', alt: 'macaco escuro de terno claro e gola alta verde' },
]

export function buildSeedNfts(): Nft[] {
  return NAMES.map((name, i) => {
    const n = i + 1
    const collection = COLLECTIONS[(n * 5) % COLLECTIONS.length]
    // Diversifica categorias além das coleções para exercitar filtros combinados.
    const category: CategoryId =
      n % 11 === 0 ? 'collectibles' : (CATEGORY_BY_COLLECTION[collection.id] ?? CATEGORIES[n % CATEGORIES.length].id)
    const creator = CREATORS[(n * 7) % CREATORS.length]
    const editions = editionsFor(n)
    const available = editions.reduce((sum, e) => sum + e.available, 0)
    const openPrices = editions.filter((e) => e.available > 0).map((e) => e.priceEth)
    const fromPriceEth = (openPrices.length ? openPrices : editions.map((e) => e.priceEth)).reduce((a, b) =>
      Number(a) <= Number(b) ? a : b,
    )
    return {
      id: `nft-${pad(n)}`,
      name,
      creator,
      collection,
      category,
      fromPriceEth,
      available,
      likes: (n * 37) % 500,
      featured: n <= 3,
      createdAt: new Date(FIXTURE_EPOCH - n * 36e5 * 13).toISOString(),
      version: 1,
      description: `"${name}" é uma obra de ${creator.name} da coleção ${collection.name}. Cada edição é registrada on-chain (simulado) e inclui arquivo em alta resolução e licença de exibição pessoal.`,
      // A capa alterna entre as artes; a galeria mostra as demais em sequência.
      images: [0, 1, 2].map((offset, vi) => {
        const art = ARTWORKS[(i + offset) % ARTWORKS.length]
        return {
          url: `/assets/monkeys/${art.file}-960.webp`,
          alt: `${name}, vista ${vi + 1}: ${art.alt}`,
        }
      }),
      editions,
      tags: [collection.name, CATEGORIES.find((c) => c.id === category)!.label, n % 2 ? 'Animado' : 'Estático'],
      blockchain: 'Ethereum',
    }
  })
}

import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  redirect,
} from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { queryClient } from '@/lib/query-client'
import { sessionStore } from '@/features/auth/session-store'
import { RootLayout } from '@/routes/RootLayout'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { parseSearch, stringifySearch, validateAuthSearch, validateHomeSearch, validateNftSearch } from '@/routes/search'

interface RouterContext {
  queryClient: QueryClient
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
})

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: validateHomeSearch,
  component: HomePage,
})

const nftRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/nft/$nftId',
  validateSearch: validateNftSearch,
  component: lazyRouteComponent(() => import('@/pages/NftDetailPage'), 'NftDetailPage'),
})

const cartRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/carrinho',
  component: lazyRouteComponent(() => import('@/pages/CartPage'), 'CartPage'),
})

const guestOnly = ({ search }: { search: { redirect?: string } }) => {
  if (sessionStore.get().status === 'authenticated') throw redirect({ href: search.redirect ?? '/' })
}

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/entrar',
  validateSearch: validateAuthSearch,
  beforeLoad: guestOnly,
  component: lazyRouteComponent(() => import('@/pages/auth/LoginPage'), 'LoginPage'),
})

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cadastro',
  validateSearch: validateAuthSearch,
  beforeLoad: guestOnly,
  component: lazyRouteComponent(() => import('@/pages/auth/RegisterPage'), 'RegisterPage'),
})

/** Rotas privadas: sem sessão, redireciona ao login preservando o destino. */
const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'auth',
  beforeLoad: ({ location }) => {
    const session = sessionStore.get()
    if (session.status !== 'authenticated') {
      throw redirect({
        to: '/entrar',
        search: { redirect: location.href, reason: session.endedBy === 'expired' ? 'expired' : undefined },
      })
    }
  },
})

const checkoutRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/checkout',
  component: lazyRouteComponent(() => import('@/pages/checkout/CheckoutPage'), 'CheckoutPage'),
})

const orderRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/pedidos/$orderId',
  component: lazyRouteComponent(() => import('@/pages/OrderPage'), 'OrderPage'),
})

const profileRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/conta/perfil',
  component: lazyRouteComponent(() => import('@/pages/account/ProfilePage'), 'ProfilePage'),
})

const walletsRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/conta/carteiras',
  component: lazyRouteComponent(() => import('@/pages/account/WalletsPage'), 'WalletsPage'),
})

const favoritesRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/conta/favoritos',
  component: lazyRouteComponent(() => import('@/pages/account/FavoritesPage'), 'FavoritesPage'),
})

const routeTree = rootRoute.addChildren([
  homeRoute,
  nftRoute,
  cartRoute,
  loginRoute,
  registerRoute,
  authRoute.addChildren([checkoutRoute, orderRoute, profileRoute, walletsRoute, favoritesRoute]),
])

export const router = createRouter({
  routeTree,
  context: { queryClient },
  parseSearch,
  stringifySearch,
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
  defaultNotFoundComponent: NotFoundPage,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

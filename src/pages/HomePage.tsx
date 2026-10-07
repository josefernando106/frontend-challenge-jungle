import { getRouteApi } from '@tanstack/react-router'
import { Hero } from '@/features/catalog/components/Hero'
import { CatalogSection, MobileCatalogBar } from '@/features/catalog/components/CatalogSection'
import { useIsMobile } from '@/lib/use-is-mobile'
import { PromoBanners } from '@/features/catalog/components/PromoBanners'
import type { HomeSearch } from '@/routes/search'

const route = getRouteApi('/')

/** Conteúdo da página inicial. Também é o fundo do modal de login/cadastro. */
export function HomeContent({ search }: { search: HomeSearch }) {
  const isMobile = useIsMobile()
  return (
    <>
      {isMobile && <MobileCatalogBar search={search} />}
      <Hero />
      <CatalogSection search={search} />
      <PromoBanners />
    </>
  )
}

export function HomePage() {
  const search = route.useSearch()
  return <HomeContent search={search} />
}

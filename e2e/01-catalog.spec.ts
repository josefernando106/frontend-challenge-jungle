import { expect, isMobile, test, useScenario } from './support'
import type { Page } from '@playwright/test'

async function withFilters(page: Page, fn: () => Promise<void>) {
  if (isMobile(page)) {
    await page.getByRole('button', { name: /^Filtros/ }).click()
    await expect(page.getByRole('dialog', { name: 'Filtros' })).toBeVisible()
    await fn()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Filtros' })).toBeHidden()
  } else {
    await fn()
  }
}

const filterScope = (page: Page) =>
  isMobile(page) ? page.getByRole('dialog', { name: 'Filtros' }) : page.getByRole('complementary', { name: 'Filtros do catálogo' })

const cardNames = (page: Page) => page.getByTestId('catalog-grid').getByRole('heading', { level: 3 })

test.describe('Catálogo', () => {
  test('busca, filtros combinados, ordenação, paginação e histórico', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('catalog-count')).toHaveText('48 resultados · página 1 de 4')

    // Paginação
    await page.getByRole('button', { name: 'Página 2' }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect(page.getByTestId('catalog-count')).toContainText('página 2 de 4')

    // Filtro reinicia a paginação; filtros combinados compõem a URL.
    await withFilters(page, async () => {
      await filterScope(page).getByLabel('Música').check()
    })
    await expect(page).toHaveURL(/cat=music/)
    await expect(page).not.toHaveURL(/page=/)
    await expect(page.getByTestId('catalog-count')).toHaveText('7 resultados')

    await withFilters(page, async () => {
      await filterScope(page).getByLabel('Arte').check()
      await filterScope(page).getByLabel('Disponíveis').check()
    })
    await expect(page).toHaveURL(/cat=art%2Cmusic|cat=art,music/)
    await expect(page).toHaveURL(/status=available/)
    await expect(page.getByTestId('catalog-grid')).toHaveAttribute('data-stale', 'false')
    await expect(page.getByTestId('catalog-count')).not.toHaveText('7 resultados')
    const combined = await page.getByTestId('catalog-count').textContent()
    expect(combined).toMatch(/^\d+ resultados/)

    // Ordenação por menor preço: o primeiro card é o mais barato.
    await page.getByLabel('Ordenar por').selectOption({ label: 'Menor preço' })
    await expect(page).toHaveURL(/sort=price_asc/)
    await expect(page.getByTestId('catalog-grid')).toHaveAttribute('data-stale', 'false')
    const prices = await page.getByTestId('catalog-grid').getByTestId('nft-price').allTextContents()
    const values = prices.map((p) => Number(p.replace(' ETH', '').replace(',', '.')))
    expect(values).toEqual([...values].sort((a, b) => a - b))

    // Busca (debounce) compõe com os filtros.
    await page.getByLabel('Buscar NFTs por nome, artista ou coleção').fill('zz-sem-resultado')
    await expect(page).toHaveURL(/q=zz-sem-resultado/)
    await expect(page.getByRole('heading', { name: 'Nenhum NFT encontrado' })).toBeVisible()

    // Histórico: voltar restaura o estado anterior (sem busca, ordenado).
    await page.goBack()
    await expect(page).not.toHaveURL(/q=/)
    await expect(page).toHaveURL(/sort=price_asc/)
    await expect(cardNames(page).first()).toBeVisible()
    await expect(page.getByLabel('Buscar NFTs por nome, artista ou coleção')).toHaveValue('')

    // Refresh preserva os filtros.
    await page.reload()
    await expect(page).toHaveURL(/status=available/)
    await expect(page.getByTestId('catalog-count')).toHaveText(combined!)

    // Histórico: sort → status → arte → (só música)
    await page.goBack()
    await expect(page).not.toHaveURL(/sort=/)
    await page.goBack()
    await expect(page).not.toHaveURL(/status=/)
    await page.goBack()
    await expect(page).toHaveURL(/cat=music$/)
    await expect(page.getByLabel('Música').first()).toBeChecked()
    await expect(page.getByTestId('catalog-count')).toHaveText('7 resultados')
  })

  test('busca por artista via URL direta', async ({ page }) => {
    await page.goto('/?q=lunar')
    await expect(page.getByTestId('catalog-count')).toHaveText('1 resultado')
    await expect(cardNames(page)).toHaveText(['Maré Lunar'])
  })

  test('descarta respostas fora de ordem', async ({ page }) => {
    await useScenario(page, 'out-of-order')
    await page.goto('/')
    // A 1ª consulta (lenta, 1,5 s) é superada por uma busca mais nova (rápida).
    await page.getByLabel('Buscar NFTs por nome, artista ou coleção').fill('Galáxia')
    await page.getByLabel('Buscar NFTs por nome, artista ou coleção').press('Enter')
    await expect(page.getByTestId('catalog-count')).toHaveText('1 resultado')
    await page.waitForTimeout(2000)
    await expect(page.getByTestId('catalog-count')).toHaveText('1 resultado')
    await expect(cardNames(page)).toHaveText(['Galáxia Distante'])
  })

  test('resultado vazio', async ({ page }) => {
    await useScenario(page, 'empty')
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Nenhum NFT encontrado' })).toBeVisible()
  })

  test('navega do catálogo para o NFT', async ({ page }) => {
    await page.goto('/')
    await cardNames(page).first().getByRole('link').click()
    await expect(page).toHaveURL(/\/nft\/nft-\d{3}/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })
})

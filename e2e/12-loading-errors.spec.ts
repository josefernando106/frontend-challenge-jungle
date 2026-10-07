import { expect, test, useScenario } from './support'

test.describe('Carregamento e recuperação', () => {
  test('skeletons durante carregamento lento', async ({ page }) => {
    await useScenario(page, 'slow')
    await page.goto('/')
    const loading = page.getByRole('list', { name: 'Carregando NFTs' })
    await expect(loading).toBeVisible()
    await expect(loading.locator('[data-slot="skeleton"]').first()).toBeVisible()
    await expect(page.getByTestId('catalog-grid')).toBeVisible({ timeout: 10_000 })
    await expect(loading).toHaveCount(0)

    await page.goto('/nft/nft-002')
    await expect(page.getByLabel('Carregando NFT')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Sonho Neon' })).toBeVisible({ timeout: 10_000 })
  })

  test('falha transitória: feedback e recuperação ao tentar novamente', async ({ page }) => {
    await useScenario(page, 'transient-error')
    await page.goto('/')
    // 3 falhas (requisição + 2 retries automáticos) → estado de erro.
    await expect(page.getByRole('heading', { name: 'Não foi possível carregar o catálogo' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('O serviço está instável no momento.')).toBeVisible()
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByTestId('catalog-grid')).toBeVisible()
    await expect(page.getByTestId('catalog-count')).toHaveText('48 resultados · página 1 de 4')
  })

  test('sem conexão mostra erro de rede', async ({ page }) => {
    await useScenario(page, 'offline')
    await page.goto('/nft/nft-001')
    await expect(page.getByText('Sem conexão com o servidor. Verifique sua internet.')).toBeVisible({ timeout: 15_000 })
  })

  test('erro 500 no carrinho', async ({ page }) => {
    await useScenario(page, 'server-error')
    await page.goto('/carrinho')
    await expect(page.getByRole('heading', { name: 'Não foi possível carregar o carrinho' })).toBeVisible({ timeout: 15_000 })
  })
})

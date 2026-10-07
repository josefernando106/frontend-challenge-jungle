import type { Page } from '@playwright/test'
import { addToCart, expect, goToReview, login, test } from './support'

/** Estabiliza a tela: fontes carregadas, painel de mocks e toasts ocultos. */
async function settle(page: Page) {
  await page.addStyleTag({
    content: '[data-testid="mock-panel-trigger"], [data-sonner-toaster] { display: none !important; }',
  })
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(300)
}

test.describe('Regressão visual', () => {
  test('início', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('catalog-grid')).toBeVisible()
    await settle(page)
    await expect(page).toHaveScreenshot('inicio.png', { fullPage: true })
  })

  test('detalhe', async ({ page }) => {
    await page.goto('/nft/nft-002')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await settle(page)
    await expect(page).toHaveScreenshot('detalhe.png', { fullPage: true, mask: [page.getByText(/^Criado em/)] })
  })

  test('carrinho', async ({ page }) => {
    await addToCart(page, 'nft-002', 2)
    await addToCart(page, 'nft-004')
    await page.goto('/carrinho')
    await expect(page.getByTestId('cart-line')).toHaveCount(2)
    await settle(page)
    await expect(page).toHaveScreenshot('carrinho.png', { fullPage: true })
  })

  test('pagamento', async ({ page }) => {
    await login(page, 'ana')
    await addToCart(page, 'nft-004')
    await page.goto('/checkout')
    await expect(page.getByTestId('review-order')).toBeVisible()
    await expect(page.getByText('MetaMask principal')).toBeVisible()
    await settle(page)
    await expect(page).toHaveScreenshot('pagamento.png', { fullPage: true })

    await goToReview(page)
    await settle(page)
    await expect(page).toHaveScreenshot('pagamento-revisao.png', {
      fullPage: true,
      mask: [page.getByText(/Cotação válida até/)],
    })
  })
})

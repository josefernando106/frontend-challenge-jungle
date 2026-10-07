import { addToCart, cartCount, expect, goToReview, login, orderCount, test, useScenario } from './support'

test.describe('Falhas de pagamento e idempotência', () => {
  test('pagamento recusado preserva os itens', async ({ page }) => {
    await useScenario(page, 'payment-declined')
    await login(page, 'ana')
    await addToCart(page, 'nft-004')
    await goToReview(page)
    await page.getByTestId('confirm-order').click()
    await expect(page.getByTestId('order-page')).toHaveAttribute('data-status', 'declined', { timeout: 10_000 })
    await expect(page.getByRole('heading', { name: 'Pagamento recusado' })).toBeVisible()
    // Nenhuma confirmação é exibida para pedido recusado.
    await expect(page.getByRole('heading', { name: 'Pedido confirmado!' })).toHaveCount(0)
    await expect.poll(() => cartCount(page)).toBe(1)
  })

  test('cliques repetidos criam um único pedido', async ({ page }) => {
    await login(page, 'ana')
    await addToCart(page, 'nft-004')
    await goToReview(page)
    const confirm = page.getByTestId('confirm-order')
    await confirm.dblclick()
    await confirm.click({ force: true }).catch(() => undefined)
    await expect(page).toHaveURL(/\/pedidos\//)
    expect(await orderCount(page)).toBe(1)
  })

  test('timeout após a criação recupera o mesmo pedido', async ({ page }) => {
    await useScenario(page, 'order-timeout')
    await login(page, 'ana')
    await addToCart(page, 'nft-004')
    await goToReview(page)
    await page.getByTestId('confirm-order').click()
    // O cliente estoura o timeout (4 s no build de testes) e reenvia com a mesma chave.
    await expect(page.getByText('O servidor demorou a responder. Tentando novamente')).toBeVisible({ timeout: 8_000 })
    await expect(page).toHaveURL(/\/pedidos\//, { timeout: 15_000 })
    expect(await orderCount(page)).toBe(1)
    await expect(page.getByTestId('order-page')).toHaveAttribute('data-status', 'confirmed', { timeout: 10_000 })
  })

  test('refresh durante o envio retoma sem duplicar', async ({ page }) => {
    await useScenario(page, 'order-timeout')
    await login(page, 'ana')
    await addToCart(page, 'nft-004')
    await goToReview(page)
    await page.getByTestId('confirm-order').click()
    await page.waitForTimeout(800)
    await page.reload()
    await expect(page).toHaveURL(/\/pedidos\//, { timeout: 15_000 })
    expect(await orderCount(page)).toBe(1)
  })
})

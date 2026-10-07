import { addToCart, expect, goToReview, login, mock, orderCount, test, useScenario, waitRealtime } from './support'

test.describe('Tempo real durante o checkout', () => {
  test('preço alterado via Socket.IO bloqueia a cotação desatualizada', async ({ page }) => {
    await login(page, 'ana')
    await addToCart(page, 'nft-004') // 0,42 ETH
    await goToReview(page)
    await waitRealtime(page)
    await expect(page.getByTestId('summary-total')).toHaveText('0,4221 ETH')

    // Evento emitido pela simulação e recebido pelo socket.io-client.
    await mock(page, 'updateNft', 'nft-004', { editionId: 'nft-004-ed1', priceEth: '0.5' })
    await expect(page.getByTestId('quote-stale')).toContainText('Astro Fiction')
    await expect(page.getByTestId('confirm-order')).toBeDisabled()

    await page.getByRole('button', { name: 'Atualizar cotação' }).click()
    await expect(page.getByTestId('quote-changed')).toContainText('0,5021 ETH')
    await expect(page.getByTestId('summary-total')).toHaveText('0,5021 ETH')
    await expect(page.getByTestId('confirm-order')).toBeEnabled()
    await page.getByTestId('confirm-order').click()
    await expect(page).toHaveURL(/\/pedidos\//)
  })

  test('carrinho informa a alteração e atualiza o resumo', async ({ page }) => {
    await addToCart(page, 'nft-004')
    await page.goto('/carrinho')
    await expect(page.getByTestId('cart-line')).toHaveCount(1)
    await waitRealtime(page)
    await mock(page, 'updateNft', 'nft-004', { priceEth: '0.6' })
    await expect(page.getByTestId('cart-notices')).toContainText('mudou de 0,42 ETH para 0,6 ETH')
    await expect(page.getByTestId('summary-subtotal')).toHaveText('0,6 ETH')
    await expect(page.getByTestId('line-status')).toContainText('Preço alterado')

    await mock(page, 'updateNft', 'nft-004', { available: 0 })
    await expect(page.getByTestId('cart-notices')).toContainText('esgotou')
    await expect(page.getByTestId('go-checkout')).toBeDisabled()
  })

  test('servidor revalida e exige nova confirmação (preço muda na confirmação)', async ({ page }) => {
    await useScenario(page, 'price-change')
    await login(page, 'ana')
    await addToCart(page, 'nft-004')
    await goToReview(page)
    await page.getByTestId('confirm-order').click()
    await expect(page.getByTestId('quote-changed')).toContainText('Os valores mudaram antes da confirmação')
    expect(await orderCount(page)).toBe(0)
    await page.getByTestId('confirm-order').click()
    await expect(page).toHaveURL(/\/pedidos\//)
    expect(await orderCount(page)).toBe(1)
  })

  test('edição esgota durante a compra', async ({ page }) => {
    await useScenario(page, 'sold-out')
    await login(page, 'ana')
    await addToCart(page, 'nft-004')
    await goToReview(page)
    await page.getByTestId('confirm-order').click()
    await expect(page.getByText('"Astro Fiction" está esgotado.')).toBeVisible()
    await expect(page.getByTestId('confirm-order')).toBeDisabled()
    expect(await orderCount(page)).toBe(0)
  })
})

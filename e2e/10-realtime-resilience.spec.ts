import { addToCart, expect, goToReview, login, mock, orderCount, test, waitRealtime } from './support'

test.describe('Resiliência do tempo real', () => {
  test('eventos duplicados e antigos não regridem o estado', async ({ page }) => {
    await page.goto('/nft/nft-004')
    await waitRealtime(page)
    await mock(page, 'updateNft', 'nft-004', { priceEth: '1.11' }) // versão 2
    await expect(page.getByTestId('detail-price')).toHaveText('1,11 ETH')
    await mock(page, 'updateNft', 'nft-004', { priceEth: '2.22' }) // versão 3
    await expect(page.getByTestId('detail-price')).toHaveText('2,22 ETH')

    // Evento antigo (versão 2) com novo eventId: ignorado.
    const stale = await mock<string | null>(page, 'replayStaleEvent', 'nft.updated')
    expect(stale).not.toBeNull()
    // Duplicata exata (mesmo eventId): ignorada.
    await mock(page, 'replayLastEvent', 'nft.updated')
    await page.waitForTimeout(500)
    await expect(page.getByTestId('detail-price')).toHaveText('2,22 ETH')
  })

  test('evento duplicado não gera aviso repetido no carrinho', async ({ page }) => {
    await addToCart(page, 'nft-004')
    await page.goto('/carrinho')
    await expect(page.getByTestId('cart-line')).toHaveCount(1)
    await waitRealtime(page)
    await mock(page, 'updateNft', 'nft-004', { priceEth: '0.7' })
    await expect(page.getByTestId('cart-notices').locator('> div')).toHaveCount(1)
    await mock(page, 'replayLastEvent', 'nft.updated')
    await page.waitForTimeout(500)
    await expect(page.getByTestId('cart-notices').locator('> div')).toHaveCount(1)
  })

  test('queda de conexão com pedido pendente e retomada após reconectar', async ({ page }) => {
    await login(page, 'ana')
    await addToCart(page, 'nft-004')
    await goToReview(page)
    await waitRealtime(page)
    await page.getByTestId('confirm-order').click()
    await expect(page.getByTestId('order-page')).toHaveAttribute('data-status', 'pending')

    // Derruba o socket e recusa reconexões enquanto o pedido é liquidado.
    await mock(page, 'disconnectSockets', { block: true })
    await expect(page.getByTestId('realtime-status')).toHaveAttribute('data-status', 'reconnecting')
    await mock(page, 'settleOrders')
    await page.waitForTimeout(800)
    // O evento order.updated foi perdido: a UI continua pendente.
    await expect(page.getByTestId('order-page')).toHaveAttribute('data-status', 'pending')

    // Ao reconectar, o cliente reconcilia via REST.
    await mock(page, 'unblockSockets')
    await waitRealtime(page)
    await expect(page.getByTestId('order-page')).toHaveAttribute('data-status', 'confirmed')
    expect(await orderCount(page)).toBe(1)
  })

  test('refresh com pedido pendente recupera o estado sem nova compra', async ({ page }) => {
    await login(page, 'ana')
    await addToCart(page, 'nft-004')
    await goToReview(page)
    await page.getByTestId('confirm-order').click()
    await expect(page.getByTestId('order-page')).toHaveAttribute('data-status', 'pending')
    await page.reload()
    await expect(page.getByTestId('order-page')).toHaveAttribute('data-status', /pending|confirmed/)
    await expect(page.getByTestId('order-page')).toHaveAttribute('data-status', 'confirmed', { timeout: 10_000 })
    // Estado terminal não regride, mesmo com evento antigo reenviado.
    await mock(page, 'replayStaleEvent', 'order.updated')
    await page.waitForTimeout(500)
    await expect(page.getByTestId('order-page')).toHaveAttribute('data-status', 'confirmed')
    expect(await orderCount(page)).toBe(1)
  })
})

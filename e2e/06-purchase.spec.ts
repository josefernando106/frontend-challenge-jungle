import { addToCart, cartCount, expect, goToReview, login, orderCount, test } from './support'

test.describe('Compra completa', () => {
  test('do catálogo ao recibo confirmado', async ({ page }) => {
    await login(page, 'ana')
    await page.goto('/')
    await page.getByTestId('catalog-grid').getByRole('link', { name: 'Astro Fiction' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Astro Fiction' })).toBeVisible()
    await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
    await expect.poll(() => cartCount(page)).toBe(1)
    await addToCart(page, 'nft-002', 2)

    await page.goto('/carrinho')
    await page.getByTestId('go-checkout').click()
    await expect(page).toHaveURL('/checkout')

    // Validação dos campos do layout
    await page.getByLabel('Nome completo').fill('')
    await page.getByTestId('review-order').click()
    await expect(page.getByText('Informe o nome completo.')).toBeVisible()
    await expect(page.getByText('Informe um telefone válido, com DDD.')).toBeVisible()
    await expect(page.getByText('Conecte uma carteira para continuar.')).toBeVisible()
    await page.getByLabel('Nome completo').fill('Ana Colecionadora')

    await goToReview(page)
    await expect(page.getByRole('list', { name: 'Itens do pedido' }).getByRole('listitem')).toHaveCount(2)
    await expect(page.getByTestId('summary-total')).toHaveText('0,9224 ETH') // 0,42 + 0,5 + 0,0024

    await page.getByTestId('confirm-order').click()
    await expect(page).toHaveURL(/\/pedidos\/ORD-/)
    await expect(page.getByTestId('order-page')).toHaveAttribute('data-status', 'pending')
    await expect(page.getByRole('heading', { name: 'Aguardando confirmação' })).toBeVisible()

    await expect(page.getByTestId('order-page')).toHaveAttribute('data-status', 'confirmed', { timeout: 10_000 })
    await expect(page.getByRole('heading', { name: 'Pedido confirmado!' })).toBeVisible()
    await expect(page.getByTestId('receipt-line')).toHaveCount(2)
    await expect(page.getByTestId('summary-total')).toHaveText('0,9224 ETH')
    expect(await orderCount(page)).toBe(1)

    // Somente os itens comprados saem do carrinho.
    await expect.poll(() => cartCount(page)).toBe(0)

    // O recibo é um snapshot: mudanças posteriores no catálogo não o alteram.
    await page.evaluate(() => (window.__mock as { updateNft: (id: string, p: object) => void }).updateNft('nft-004', { priceEth: '9' }))
    await page.reload()
    await expect(page.getByTestId('summary-total')).toHaveText('0,9224 ETH')
  })
})

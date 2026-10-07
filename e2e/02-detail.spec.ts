import { expect, test } from './support'

test.describe('Detalhe do NFT', () => {
  test('acesso direto, galeria, edições e limite de quantidade', async ({ page }) => {
    await page.goto('/nft/nft-001')
    await expect(page.getByRole('heading', { level: 1, name: 'Galáxia Distante' })).toBeVisible()

    // Galeria
    await page.getByRole('button', { name: 'Ver imagem 2 de 3' }).click()
    await expect(page.getByRole('button', { name: 'Ver imagem 2 de 3' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('gallery-main')).toHaveAttribute('src', /monkey-fone-960\.webp/)

    // Edição Genesis: máximo 2 por pedido.
    const increase = page.getByRole('button', { name: 'Aumentar quantidade' })
    await increase.click()
    await expect(page.getByRole('spinbutton', { name: 'Quantidade' })).toHaveValue('2')
    await expect(increase).toBeDisabled()
    await expect(page.getByTestId('limit-hint')).toContainText('Máximo de 2 por pedido')
  })

  test('edição indisponível não pode ser selecionada', async ({ page }) => {
    await page.goto('/nft/nft-005')
    const soldOut = page.getByRole('radio', { name: /Edição Ouro/ })
    await expect(soldOut).toBeDisabled()
    await expect(page.getByText('Esgotada')).toBeVisible()
  })

  test('NFT totalmente esgotado bloqueia a compra', async ({ page }) => {
    await page.goto('/nft/nft-007')
    await expect(page.getByRole('button', { name: 'Edição esgotada' })).toBeDisabled()
  })

  test('edição pela URL é respeitada', async ({ page }) => {
    await page.goto('/nft/nft-002?edition=nft-002-ed2')
    await expect(page.getByRole('radio', { name: /Edição Ouro/ })).toBeChecked()
  })

  test('NFT inexistente', async ({ page }) => {
    await page.goto('/nft/nao-existe')
    await expect(page.getByRole('heading', { name: 'NFT não encontrado' })).toBeVisible()
    await page.getByRole('link', { name: 'Explorar catálogo' }).click()
    await expect(page).toHaveURL('/')
  })

  test('rota inexistente', async ({ page }) => {
    await page.goto('/rota/que/nao/existe')
    await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
  })
})

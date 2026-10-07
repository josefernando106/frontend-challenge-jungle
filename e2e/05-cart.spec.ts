import { addToCart, cartCount, expect, login, logout, test, USERS } from './support'

test.describe('Carrinho', () => {
  test('quantidades, remoção, cupom e persistência', async ({ page }) => {
    await addToCart(page, 'nft-002', 2) // Genesis 0,25 ETH (máx. 2)
    await addToCart(page, 'nft-004')
    await expect.poll(() => cartCount(page)).toBe(3)

    await page.goto('/carrinho')
    const lines = page.getByTestId('cart-line')
    await expect(lines).toHaveCount(2)
    await expect(page.getByTestId('summary-subtotal')).toHaveText('0,92 ETH') // 2×0,25 + 0,42

    // Alterar quantidade
    await lines.first().getByRole('button', { name: 'Diminuir quantidade' }).click()
    await expect(page.getByTestId('summary-subtotal')).toHaveText('0,67 ETH')

    // Cupom inválido / expirado / válido
    await page.getByLabel('Cupom de desconto').fill('NAOEXISTE')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByText('Cupom inválido.')).toBeVisible()
    await expect(page.getByLabel('Cupom de desconto')).toHaveAttribute('aria-invalid', 'true')

    await page.getByLabel('Cupom de desconto').fill('EXPIRADO20')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByText('Este cupom expirou.')).toBeVisible()

    await page.getByLabel('Cupom de desconto').fill('JUNGLE10')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByTestId('summary-discount')).toHaveText('− 0,067 ETH')
    // total = 0,67 − 0,067 + taxa (0,0021 + 0,0003)
    await expect(page.getByTestId('summary-total')).toHaveText('0,6054 ETH')

    // Refresh mantém itens e cupom
    await page.reload()
    await expect(page.getByTestId('cart-line')).toHaveCount(2)
    await expect(page.getByTestId('summary-total')).toHaveText('0,6054 ETH')

    // Remover cupom e item
    await page.getByRole('button', { name: 'Remover cupom JUNGLE10' }).click()
    await expect(page.getByTestId('summary-discount')).toHaveText('0 ETH')
    await page.getByRole('button', { name: /Remover Astro Fiction/ }).click()
    await expect(page.getByTestId('cart-line')).toHaveCount(1)
  })

  test('itens do visitante são preservados ao autenticar', async ({ page }) => {
    await addToCart(page, 'nft-004')
    await page.goto('/carrinho')
    await page.getByTestId('go-checkout').click()
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fcheckout/)
    await page.getByRole('textbox', { name: 'E-mail', exact: true }).fill(USERS.carla.email)
    await page.getByLabel('Senha').fill(USERS.carla.password)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page).toHaveURL('/checkout')
    await expect.poll(() => cartCount(page)).toBe(1)

    await page.goto('/carrinho')
    await expect(page.getByTestId('cart-line')).toContainText('Astro Fiction')
  })

  test('carrinho do usuário persiste entre logins', async ({ page }) => {
    await login(page, 'bruno')
    await addToCart(page, 'nft-004')
    await logout(page)
    await expect.poll(() => cartCount(page)).toBe(0)
    await login(page, 'bruno')
    await expect.poll(() => cartCount(page)).toBe(1)
  })
})

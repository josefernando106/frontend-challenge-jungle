import { expect, login, test, useScenario } from './support'

test.describe('Favoritos', () => {
  test('favoritar persiste para o usuário autenticado', async ({ page }) => {
    await login(page, 'carla', '/nft/nft-003')
    const toggle = page.getByTestId('favorite-toggle')
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('"Mente Cristalina" adicionado aos favoritos')).toBeVisible()

    await page.reload()
    await expect(page.getByTestId('favorite-toggle')).toHaveAttribute('aria-pressed', 'true')

    await page.goto('/conta/favoritos')
    await expect(page.getByTestId('favorites-grid')).toContainText('Mente Cristalina')
  })

  test('falha na mutation faz rollback do estado otimista', async ({ page }) => {
    await useScenario(page, 'favorites-failure')
    await login(page, 'carla', '/nft/nft-003')
    const toggle = page.getByTestId('favorite-toggle')
    await toggle.click()
    // Otimista: muda na hora…
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    // …e volta após o erro, com aviso acessível.
    await expect(page.getByText('Não foi possível favoritar')).toBeVisible()
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await page.reload()
    await expect(page.getByTestId('favorite-toggle')).toHaveAttribute('aria-pressed', 'false')
  })

  test('visitante é levado ao login ao favoritar', async ({ page }) => {
    await page.goto('/nft/nft-003')
    await page.getByTestId('favorite-toggle').click()
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fnft%2Fnft-003/)
  })
})

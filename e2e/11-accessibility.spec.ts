import AxeBuilder from '@axe-core/playwright'
import { expect, isMobile, test } from './support'

test.describe('Acessibilidade', () => {
  test('skip link e navegação por teclado até um NFT', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('nft-card').first()).toBeVisible()
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
    await expect(skip).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/#conteudo/)

    // Busca acessível por teclado
    const search = page.getByLabel('Buscar NFTs por nome, artista ou coleção')
    await search.focus()
    await page.keyboard.type('Sonho')
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('catalog-count')).toHaveText('1 resultado')
    const link = page.getByTestId('catalog-grid').getByRole('link', { name: 'Sonho Neon' })
    await link.focus()
    await expect(link).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { level: 1, name: 'Sonho Neon' })).toBeVisible()
  })

  test('foco preso em drawer e devolvido ao fechar', async ({ page }) => {
    await page.goto('/')
    const trigger = isMobile(page)
      ? page.getByRole('button', { name: 'Abrir menu' })
      : page.getByTestId('mock-panel-trigger')
    await trigger.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    // O foco permanece dentro do diálogo ao tabular repetidamente.
    for (let i = 0; i < 15; i++) await page.keyboard.press('Tab')
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('erros de formulário associados aos campos', async ({ page }) => {
    await page.goto('/entrar')
    await page.getByRole('button', { name: 'Entrar' }).click()
    const email = page.getByRole('textbox', { name: 'E-mail', exact: true })
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    const describedBy = await email.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    await expect(page.locator(`#${describedBy!.split(' ').pop()}`)).toHaveText(/Informe um e-mail válido/)
    await expect(email).toBeFocused()
  })

  for (const path of ['/', '/nft/nft-002', '/carrinho', '/entrar', '/cadastro']) {
    test(`sem violações axe (WCAG A/AA) em ${path}`, async ({ page }) => {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([])
    })
  }
})

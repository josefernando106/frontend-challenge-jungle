import { expect, login, logout, mock, openAccountMenu, test, useScenario, USERS } from './support'

test.describe('Conta e sessão', () => {
  test('cadastro com validação e conflito', async ({ page }) => {
    await page.goto('/cadastro')
    await page.getByRole('button', { name: /^Criar (conta|perfil)$/ }).click()
    await expect(page.getByLabel('Nome de usuário')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByText('Informe seu nome (mín. 2 caracteres).')).toBeVisible()

    await page.getByLabel('Nome de usuário').fill('Teste E2E')
    await page.getByRole('textbox', { name: 'E-mail', exact: true }).fill(USERS.ana.email)
    await page.getByLabel('Senha', { exact: true }).fill('abc12345')
    await page.getByLabel('Confirmar senha').fill('abc12345')
    await page.getByRole('button', { name: /^Criar (conta|perfil)$/ }).click()
    await expect(page.getByText('E-mail já cadastrado. Faça login.')).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'E-mail', exact: true })).toHaveAttribute('aria-invalid', 'true')

    await page.getByRole('textbox', { name: 'E-mail', exact: true }).fill('novo.usuario@nft.dev')
    await page.getByRole('button', { name: /^Criar (conta|perfil)$/ }).click()
    await expect(page).toHaveURL('/')
    await openAccountMenu(page)
    await expect(page.getByText(/Sair/).first()).toBeVisible()
  })

  test('login inválido e retorno ao fluxo anterior', async ({ page }) => {
    await page.goto('/conta/carteiras')
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fconta%2Fcarteiras/)
    await page.getByRole('textbox', { name: 'E-mail', exact: true }).fill(USERS.ana.email)
    await page.getByLabel('Senha').fill('errada123')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByTestId('login-error')).toHaveText('E-mail ou senha incorretos.')

    await page.getByLabel('Senha').fill(USERS.ana.password)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page).toHaveURL('/conta/carteiras')
    await expect(page.getByRole('heading', { name: 'Carteiras', level: 1 })).toBeVisible()
  })

  test('sessão sobrevive a refresh e expira durante a navegação', async ({ page }) => {
    await login(page, 'ana', '/conta/perfil')
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Minha conta' })).toBeVisible()

    await mock(page, 'expireSessions')
    // A aplicação pode detectar a expiração sozinha (requisição/evento em andamento) antes de o
    // clique concluir; os dois caminhos devem terminar no login com o motivo "expired".
    await page
      .getByRole('link', { name: 'Carteiras' })
      .first()
      .click({ timeout: 5_000 })
      .catch(() => undefined)
    await expect(page).toHaveURL(/\/entrar\?.*reason=expired/)
    await expect(page.getByText('Sua sessão expirou. Entre novamente para continuar de onde parou.')).toBeVisible()

    await page.getByRole('textbox', { name: 'E-mail', exact: true }).fill(USERS.ana.email)
    await page.getByLabel('Senha').fill(USERS.ana.password)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page).toHaveURL(/\/conta\/(perfil|carteiras)/)
  })

  test('expiração controlada pelo relógio (cenário de sessão curta)', async ({ page }) => {
    await page.clock.install()
    await useScenario(page, 'session-expired')
    await login(page, 'bruno', '/conta/perfil')
    await expect(page.getByRole('heading', { name: 'Minha conta' })).toBeVisible()
    await page.clock.fastForward('00:25')
    await page.reload()
    await expect(page).toHaveURL(/\/entrar/)
  })

  test('logout e troca de usuário isolam os dados privados', async ({ page }) => {
    await login(page, 'ana', '/conta/favoritos')
    await expect(page.getByTestId('favorites-grid').getByRole('listitem')).toHaveCount(2)
    await logout(page)

    await page.goto('/conta/favoritos')
    await expect(page).toHaveURL(/\/entrar/)

    await login(page, 'bruno', '/conta/favoritos')
    await expect(page.getByTestId('favorites-grid').getByRole('listitem')).toHaveCount(1)
    await expect(page.getByTestId('favorites-grid')).toContainText('Pulso Violeta')
    await expect(page.getByTestId('favorites-grid')).not.toContainText('Sonho Neon')

    // O socket da nova sessão pertence ao Bruno.
    const clients = await mock<{ userId: string | null }[]>(page, 'connectedClients')
    expect(clients.every((c) => c.userId === 'usr-bruno')).toBe(true)
  })
})

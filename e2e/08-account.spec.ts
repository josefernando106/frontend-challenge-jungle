import { expect, login, test } from './support'

// PNG 1×1 válido.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

test.describe('Perfil e carteiras', () => {
  test('edição de perfil com validação, conflito e persistência', async ({ page }) => {
    await login(page, 'carla', '/conta/perfil')
    const form = page.getByRole('form', { name: 'Dados pessoais' })

    await form.getByLabel('Nome de usuário').fill('Inválido!')
    await form.getByRole('button', { name: 'Salvar alterações' }).click()
    await expect(form.getByText('Use 3–30 caracteres')).toBeVisible()
    await expect(form.getByLabel('Nome de usuário')).toHaveAttribute('aria-invalid', 'true')

    // Conflito retornado pela API
    await form.getByLabel('Nome de usuário').fill('carla.nova')
    await form.getByRole('textbox', { name: 'E-mail', exact: true }).fill('bruno@nft.dev')
    await form.getByRole('button', { name: 'Salvar alterações' }).click()
    await expect(form.getByText('E-mail já em uso por outra conta.')).toBeVisible()

    await form.getByRole('textbox', { name: 'E-mail', exact: true }).fill('carla@nft.dev')
    await form.getByLabel('Nome', { exact: true }).fill('Carla Nova Silva')
    await form.getByLabel('Bio').fill('Colecionadora de fotografia.')
    await form.getByRole('button', { name: 'Salvar alterações' }).click()
    await expect(page.getByText('Perfil atualizado')).toBeVisible()

    await page.reload()
    await expect(page.getByRole('form', { name: 'Dados pessoais' }).getByLabel('Nome', { exact: true })).toHaveValue(
      'Carla Nova Silva',
    )
  })

  test('avatar: tipo inválido e upload válido', async ({ page }) => {
    await login(page, 'carla', '/conta/perfil')
    const input = page.locator('#avatar-input')
    await input.setInputFiles({ name: 'nota.txt', mimeType: 'text/plain', buffer: Buffer.from('oi') })
    await expect(page.getByText('Formato não suportado. Use PNG, JPEG ou WEBP.')).toBeVisible()

    await input.setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: PNG })
    await expect(page.getByText('Avatar atualizado')).toBeVisible()
    await expect(page.getByTestId('profile-avatar')).toHaveAttribute('src', /^data:image\//)
    await page.reload()
    await expect(page.getByTestId('profile-avatar')).toHaveAttribute('src', /^data:image\//)
  })

  test('alteração de senha com erros e sucesso', async ({ page }) => {
    await login(page, 'carla', '/conta/perfil')
    const form = page.getByRole('form', { name: 'Alterar senha' })
    await form.getByLabel('Senha atual').fill('errada000')
    await form.getByLabel('Nova senha', { exact: true }).fill('curta')
    await form.getByLabel('Confirmar nova senha').fill('curta')
    await form.getByRole('button', { name: 'Alterar senha' }).click()
    await expect(form.getByText('Mínimo de 8 caracteres.')).toBeVisible()

    await form.getByLabel('Nova senha', { exact: true }).fill('NovaSenha1')
    await form.getByLabel('Confirmar nova senha').fill('NovaSenha1')
    await form.getByRole('button', { name: 'Alterar senha' }).click()
    await expect(form.getByText('Senha atual incorreta.')).toBeVisible()

    await form.getByLabel('Senha atual').fill('Senha@123')
    await form.getByRole('button', { name: 'Alterar senha' }).click()
    await expect(page.getByText('Senha alterada com sucesso')).toBeVisible()
  })

  test('cadastro e edição de carteiras principal e secundária', async ({ page }) => {
    await login(page, 'carla', '/conta/carteiras')
    const primary = page.getByTestId('wallet-form-primary')

    await primary.getByRole('button', { name: 'Cadastrar carteira' }).click()
    await expect(primary.getByText('Nome deve ter entre 2 e 40 caracteres.')).toBeVisible()
    await expect(primary.getByText('Selecione o provedor.')).toBeVisible()

    await primary.getByLabel('Nome da carteira').fill('Minha MetaMask')
    await primary.getByLabel('Provedor').click()
    await page.getByRole('option', { name: 'MetaMask' }).click()
    await primary.getByLabel('Endereço').fill('0x123')
    await primary.getByRole('button', { name: 'Cadastrar carteira' }).click()
    await expect(primary.getByText('Endereço inválido (0x + 40 caracteres hexadecimais).')).toBeVisible()

    await primary.getByLabel('Endereço').fill('0xAbCdEf0123456789aBcDeF0123456789AbCdEf01')
    await primary.getByLabel('Polygon').check()
    await primary.getByRole('button', { name: 'Cadastrar carteira' }).click()
    await expect(page.getByText('Carteira principal cadastrada')).toBeVisible()

    // Secundária com o mesmo endereço → conflito da API
    const secondary = page.getByTestId('wallet-form-secondary')
    await secondary.getByLabel('Nome da carteira').fill('Reserva')
    await secondary.getByLabel('Provedor').click()
    await page.getByRole('option', { name: 'Coinbase Wallet' }).click()
    await secondary.getByLabel('Endereço').fill('0xAbCdEf0123456789aBcDeF0123456789AbCdEf01')
    await secondary.getByRole('button', { name: 'Cadastrar carteira' }).click()
    await expect(secondary.getByText('Este endereço já está cadastrado.')).toBeVisible()

    await page.reload()
    const saved = page.getByTestId('wallet-form-primary')
    await expect(saved.getByLabel('Nome da carteira')).toHaveValue('Minha MetaMask')
    await saved.getByLabel('Nome da carteira').fill('MetaMask renomeada')
    await saved.getByRole('button', { name: 'Salvar alterações' }).click()
    await expect(page.getByText('Carteira principal atualizada')).toBeVisible()
  })
})

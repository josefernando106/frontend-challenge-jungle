import { expect, test as base, type Page } from '@playwright/test'

declare global {
  interface Window {
    __mock?: unknown
  }
}

/** Seleciona o cenário MSW antes de qualquer script da página rodar. */
export async function useScenario(page: Page, scenario: string) {
  await page.addInitScript((id) => {
    if (!sessionStorage.getItem('e2e:scenario-set')) {
      localStorage.setItem('nftmkt:mock-scenario', id)
      sessionStorage.setItem('e2e:scenario-set', '1')
    }
  }, scenario)
}

/** Chama a API de controle da simulação (`window.__mock`). */
export async function mock<T = unknown>(page: Page, method: string, ...args: unknown[]): Promise<T> {
  await page.waitForFunction(() => !!window.__mock)
  return page.evaluate(
    ([m, a]) => (window.__mock as unknown as Record<string, (...x: unknown[]) => unknown>)[m as string](...(a as unknown[])),
    [method, args] as const,
  ) as Promise<T>
}

export async function waitRealtime(page: Page) {
  await expect(page.getByTestId('realtime-status')).toHaveAttribute('data-status', 'connected', { timeout: 10_000 })
}

export const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1440) < 1024

export const USERS = {
  ana: { email: 'ana@nft.dev', password: 'Senha@123', name: 'Ana Colecionadora' },
  bruno: { email: 'bruno@nft.dev', password: 'Senha@123', name: 'Bruno Pixel' },
  carla: { email: 'carla@nft.dev', password: 'Senha@123', name: 'Carla Nova' },
}

export async function login(page: Page, user: keyof typeof USERS, redirect?: string) {
  const { email, password } = USERS[user]
  await page.goto(redirect ? `/entrar?redirect=${encodeURIComponent(redirect)}` : '/entrar')
  await page.getByRole('textbox', { name: 'E-mail', exact: true }).fill(email)
  await page.getByLabel('Senha').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).not.toHaveURL(/\/entrar/)
}

/** Abre o menu da conta (desktop) ou o menu lateral (mobile). */
export async function openAccountMenu(page: Page) {
  if (isMobile(page)) await page.getByRole('button', { name: 'Abrir menu' }).click()
  else await page.getByTestId('user-menu').click()
}

export async function logout(page: Page) {
  await openAccountMenu(page)
  if (isMobile(page)) await page.getByRole('button', { name: 'Sair' }).click()
  else await page.getByRole('menuitem', { name: 'Sair' }).click()
  await expect(page.getByText('Você saiu da conta.')).toBeVisible()
}

export async function addToCart(page: Page, nftId: string, quantity = 1, edition?: string) {
  await page.goto(`/nft/${nftId}${edition ? `?edition=${edition}` : ''}`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  for (let i = 1; i < quantity; i++) await page.getByRole('button', { name: 'Aumentar quantidade' }).click()
  await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
  await expect(page.getByText('Adicionado ao carrinho').first()).toBeVisible()
}

export async function cartCount(page: Page) {
  const label = await page.getByTestId('header-cart').getAttribute('aria-label')
  return Number(/(\d+)/.exec(label ?? '')?.[1] ?? 0)
}

/** Preenche o checkout, conecta a carteira e vai para a revisão. */
export async function goToReview(page: Page) {
  await page.goto('/checkout')
  await page.getByLabel('Telefone').fill('(11) 91234-5678')
  await page.getByRole('button', { name: 'Conectar carteira' }).click()
  await expect(page.getByTestId('wallet-connected')).toBeVisible()
  await page.getByTestId('review-order').click()
  await expect(page.getByRole('heading', { name: '3. Revise seu pedido' })).toBeVisible()
}

export async function orderCount(page: Page) {
  const snap = await mock<{ orders: unknown[] }>(page, 'snapshot')
  return snap.orders.length
}

export const test = base
export { expect }

/**
 * Auditoria Lighthouse: 3 medições por página × perfil (mobile/desktop), mediana por categoria.
 * Saída em lighthouse/reports (HTML/JSON de cada execução) + lighthouse/summary.{json,md}.
 *
 *   npm run lighthouse            # build + preview + auditoria
 *   npm run lighthouse -- --skip-build
 */
import { spawn, execSync } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import lighthouse from 'lighthouse'
import desktopConfig from 'lighthouse/core/config/desktop-config.js'
import * as chromeLauncher from 'chrome-launcher'
import { chromium } from '@playwright/test'
import config from '../lighthouse/audit.config.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'lighthouse')
const reportsDir = join(outDir, 'reports')
const skipBuild = process.argv.includes('--skip-build')

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

async function waitForServer(url, timeoutMs = 30_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(`Servidor não respondeu em ${url}`)
}

async function main() {
  if (!skipBuild) {
    console.log('› build otimizado (mocks ativos)…')
    execSync('npm run build', { cwd: root, stdio: 'inherit' })
  }

  const base = `http://localhost:${config.port}`
  const server = spawn('npx', ['vite', 'preview', '--port', String(config.port), '--strictPort'], {
    cwd: root,
    shell: true,
    stdio: 'ignore',
  })

  rmSync(reportsDir, { recursive: true, force: true })
  mkdirSync(reportsDir, { recursive: true })

  const chromePath = process.env.CHROME_PATH || chromium.executablePath()
  let chrome
  const results = []
  try {
    await waitForServer(base)
    chrome = await chromeLauncher.launch({ chromePath, chromeFlags: ['--headless=new', '--no-sandbox'] })

    for (const page of config.pages) {
      for (const profile of config.profiles) {
        const runs = []
        for (let i = 1; i <= config.runs; i++) {
          const flags = {
            port: chrome.port,
            output: ['html', 'json'],
            onlyCategories: config.categories,
            logLevel: 'error',
          }
          const result = await lighthouse(`${base}${page.path}`, flags, profile === 'desktop' ? desktopConfig : undefined)
          const [html, json] = result.report
          const name = `${page.id}-${profile}-run${i}`
          writeFileSync(join(reportsDir, `${name}.html`), html)
          writeFileSync(join(reportsDir, `${name}.json`), json)
          const lhr = result.lhr
          const scores = Object.fromEntries(config.categories.map((c) => [c, Math.round((lhr.categories[c]?.score ?? 0) * 100)]))
          const metrics = Object.fromEntries(
            Object.entries(config.metrics).map(([k, id]) => [k, lhr.audits[id]?.numericValue ?? null]),
          )
          runs.push({ scores, metrics, lighthouseVersion: lhr.lighthouseVersion, userAgent: lhr.environment.hostUserAgent })
          console.log(`  ${name}: ${config.categories.map((c) => `${c}=${scores[c]}`).join(' ')}`)
        }
        results.push({
          page: page.id,
          path: page.path,
          profile,
          median: {
            scores: Object.fromEntries(config.categories.map((c) => [c, median(runs.map((r) => r.scores[c]))])),
            metrics: Object.fromEntries(Object.keys(config.metrics).map((k) => [k, median(runs.map((r) => r.metrics[k]))])),
          },
          runs,
        })
      }
    }
  } finally {
    if (chrome) await chrome.kill()
    server.kill()
    if (process.platform === 'win32' && server.pid) {
      try {
        execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: 'ignore' })
      } catch {
        /* já encerrado */
      }
    }
  }

  const environment = {
    date: new Date().toISOString(),
    lighthouse: results[0]?.runs[0]?.lighthouseVersion,
    browser: results[0]?.runs[0]?.userAgent,
    node: process.version,
    os: `${os.type()} ${os.release()} (${os.arch()})`,
    cpu: os.cpus()[0]?.model,
    conditions:
      'Build otimizado (vite build --mode mocks) servido localmente por vite preview; cenário "default" dos mocks; ' +
      'mobile = perfil padrão do Lighthouse (Moto G Power, 4G lento simulado, CPU 4×); desktop = desktop-config (sem throttling de CPU, rede cabeada simulada).',
  }
  writeFileSync(join(outDir, 'summary.json'), JSON.stringify({ environment, targets: config.targets, results }, null, 2))

  const fmt = (k, v) => (v == null ? '—' : k === 'CLS' ? v.toFixed(3) : `${Math.round(v)} ms`)
  const lines = [
    '# Lighthouse — resultados (mediana de 3 execuções)',
    '',
    `- Data: ${environment.date}`,
    `- Lighthouse: ${environment.lighthouse}`,
    `- Navegador: ${environment.browser}`,
    `- Node: ${environment.node} · SO: ${environment.os} · CPU: ${environment.cpu}`,
    `- Condições: ${environment.conditions}`,
    '',
    '| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...results.map((r) => {
      const s = r.median.scores
      const m = r.median.metrics
      const mark = (c) => `${s[c]}${s[c] < config.targets[c] ? ' ⚠️' : ''}`
      return `| ${r.page} (${r.path}) | ${r.profile} | ${mark('performance')} | ${mark('accessibility')} | ${mark('best-practices')} | ${mark('seo')} | ${fmt('LCP', m.LCP)} | ${fmt('CLS', m.CLS)} | ${fmt('TBT', m.TBT)} |`
    }),
    '',
    `Metas: Performance ≥ ${config.targets.performance}, Accessibility ≥ ${config.targets.accessibility}, Best Practices ≥ ${config.targets['best-practices']}, SEO ≥ ${config.targets.seo}.`,
    'Relatórios completos: `lighthouse/reports/*.html` e `*.json`.',
    '',
  ]
  writeFileSync(join(outDir, 'SUMMARY.md'), lines.join('\n'))
  console.log(`\n${lines.join('\n')}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

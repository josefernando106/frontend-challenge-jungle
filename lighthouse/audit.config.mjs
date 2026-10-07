/**
 * Configuração versionada da auditoria Lighthouse (executada por `npm run lighthouse`).
 * Build otimizado (`vite build --mode mocks`) servido por `vite preview`, cenário padrão dos mocks.
 */
export default {
  port: 4174,
  runs: 3,
  pages: [
    { id: 'inicio', path: '/' },
    { id: 'detalhe', path: '/nft/nft-002' },
  ],
  profiles: ['mobile', 'desktop'],
  categories: ['performance', 'accessibility', 'best-practices', 'seo'],
  targets: { performance: 90, accessibility: 95, 'best-practices': 95, seo: 90 },
  metrics: {
    LCP: 'largest-contentful-paint',
    CLS: 'cumulative-layout-shift',
    TBT: 'total-blocking-time',
    FCP: 'first-contentful-paint',
    SI: 'speed-index',
  },
}

# Lighthouse — resultados (mediana de 3 execuções)

- Data: 2026-10-06T17:39:37.729Z
- Lighthouse: 13.5.0
- Navegador: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.0.0 Safari/537.36
- Node: v24.21.0 · SO: Windows_NT 10.0.26300 (x64) · CPU: AMD Ryzen 7 5700X3D 8-Core Processor           
- Condições: Build otimizado (vite build --mode mocks) servido localmente por vite preview; cenário "default" dos mocks; mobile = perfil padrão do Lighthouse (Moto G Power, 4G lento simulado, CPU 4×); desktop = desktop-config (sem throttling de CPU, rede cabeada simulada).

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| inicio (/) | mobile | 90 | 100 | 100 | 100 | 3066 ms | 0.018 | 182 ms |
| inicio (/) | desktop | 99 | 100 | 100 | 100 | 871 ms | 0.017 | 1 ms |
| detalhe (/nft/nft-002) | mobile | 93 | 100 | 100 | 100 | 3103 ms | 0.000 | 76 ms |
| detalhe (/nft/nft-002) | desktop | 99 | 100 | 100 | 100 | 831 ms | 0.001 | 0 ms |

Metas: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90.
Relatórios completos: `lighthouse/reports/*.html` e `*.json`.

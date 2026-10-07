/**
 * Gera os assets visuais locais (arte dos NFTs, avatares e favicon) de forma determinística.
 * Os arquivos resultantes ficam versionados em public/assets, então este script só precisa
 * ser executado se a quantidade de fixtures mudar: `npm run assets`.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
const NFT_COUNT = 48
const VARIANTS = ['a', 'b', 'c']
const ARTISTS = 12
const USERS = 4

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const hsl = (h, s, l) => `hsl(${Math.round(h) % 360} ${s}% ${l}%)`

function artwork(index, variant) {
  const rand = mulberry32(index * 7919 + variant * 104729 + 17)
  const baseHue = (index * 47) % 360
  const hueShift = 40 + rand() * 120
  const style = index % 4
  const size = 600
  const defs = []
  const shapes = []

  defs.push(
    `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hsl(baseHue, 70, 22 + variant * 4)}"/><stop offset="1" stop-color="${hsl(baseHue + hueShift, 75, 45)}"/></linearGradient>`,
  )
  shapes.push(`<rect width="${size}" height="${size}" fill="url(#bg)"/>`)

  const blobs = 4 + Math.floor(rand() * 4)
  for (let i = 0; i < blobs; i++) {
    const id = `g${i}`
    const hue = baseHue + rand() * 200
    defs.push(
      `<radialGradient id="${id}"><stop offset="0" stop-color="${hsl(hue, 90, 65)}" stop-opacity="0.95"/><stop offset="1" stop-color="${hsl(hue + 30, 90, 50)}" stop-opacity="0"/></radialGradient>`,
    )
    const cx = Math.round(rand() * size)
    const cy = Math.round(rand() * size)
    const r = Math.round(120 + rand() * 220)
    shapes.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id})"/>`)
  }

  if (style === 0) {
    for (let i = 0; i < 9; i++) {
      const r = 260 - i * 26
      shapes.push(
        `<circle cx="300" cy="${300 + variant * 20}" r="${r}" fill="none" stroke="${hsl(baseHue + i * 18, 85, 70)}" stroke-width="6" stroke-opacity="${0.25 + i * 0.07}"/>`,
      )
    }
  } else if (style === 1) {
    for (let i = 0; i < 7; i++) {
      const x = Math.round(rand() * 420)
      const y = Math.round(rand() * 420)
      const w = Math.round(80 + rand() * 180)
      shapes.push(
        `<rect x="${x}" y="${y}" width="${w}" height="${w}" rx="${Math.round(rand() * 40)}" transform="rotate(${Math.round(rand() * 90)} ${x + w / 2} ${y + w / 2})" fill="${hsl(baseHue + i * 30, 80, 60)}" fill-opacity="0.55"/>`,
      )
    }
  } else if (style === 2) {
    const points = []
    for (let i = 0; i < 12; i++) {
      points.push(`${Math.round(rand() * size)},${Math.round(rand() * size)}`)
    }
    shapes.push(
      `<polyline points="${points.join(' ')}" fill="none" stroke="${hsl(baseHue + 180, 90, 75)}" stroke-width="10" stroke-linejoin="round" stroke-opacity="0.8"/>`,
    )
    for (let i = 0; i < 18; i++) {
      shapes.push(
        `<circle cx="${Math.round(rand() * size)}" cy="${Math.round(rand() * size)}" r="${Math.round(6 + rand() * 18)}" fill="${hsl(baseHue + 200, 90, 80)}" fill-opacity="0.85"/>`,
      )
    }
  } else {
    for (let i = 0; i < 6; i++) {
      const y = 80 + i * 90 + variant * 10
      shapes.push(
        `<path d="M0 ${y} C 150 ${y - 80 - rand() * 60}, 450 ${y + 80 + rand() * 60}, 600 ${y}" fill="none" stroke="${hsl(baseHue + i * 25, 85, 68)}" stroke-width="${10 + i * 3}" stroke-opacity="0.7" stroke-linecap="round"/>`,
      )
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><defs>${defs.join('')}</defs>${shapes.join('')}</svg>`
}

function avatar(seed, label) {
  const rand = mulberry32(seed * 31 + 5)
  const hue = Math.round(rand() * 360)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120"><defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hsl(hue, 70, 55)}"/><stop offset="1" stop-color="${hsl(hue + 90, 70, 35)}"/></linearGradient></defs><rect width="120" height="120" fill="url(#a)"/><circle cx="60" cy="48" r="22" fill="${hsl(hue + 40, 60, 85)}"/><path d="M20 120c4-28 20-40 40-40s36 12 40 40z" fill="${hsl(hue + 40, 60, 85)}"/><text x="60" y="114" font-family="monospace" font-size="0">${label}</text></svg>`
}

function write(path, content) {
  const full = join(root, path)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content)
}

for (let i = 1; i <= NFT_COUNT; i++) {
  VARIANTS.forEach((v, vi) => {
    write(`assets/nfts/nft-${String(i).padStart(2, '0')}-${v}.svg`, artwork(i, vi))
  })
}
for (let i = 1; i <= ARTISTS; i++) {
  write(`assets/avatars/artist-${String(i).padStart(2, '0')}.svg`, avatar(i, `artist-${i}`))
}
for (let i = 1; i <= USERS; i++) {
  write(`assets/avatars/user-${String(i).padStart(2, '0')}.svg`, avatar(100 + i, `user-${i}`))
}

write(
  'favicon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#2b2b2b"/><path d="M7 13l2-5h14l2 5v1a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z M9 17v7h14v-7" fill="none" stroke="#a259ff" stroke-width="2" stroke-linejoin="round"/></svg>`,
)

console.log(`Assets gerados em ${root}`)

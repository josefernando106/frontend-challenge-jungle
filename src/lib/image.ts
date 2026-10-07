export const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp']
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024

/** Redimensiona a imagem no navegador (máx. `size` px) e retorna um data URL WEBP/JPEG. */
export async function resizeImage(file: File, size = 256): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, size / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const webp = canvas.toDataURL('image/webp', 0.85)
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.85)
}

/**
 * srcset das artes do catálogo: cada `*-960.webp` tem uma variante `*-480.webp`.
 * Outras URLs (ex.: avatares) seguem sem srcset.
 */
export function artworkSrcSet(url: string): string | undefined {
  if (!url.endsWith('-960.webp')) return undefined
  return `${url.replace(/-960\.webp$/, '-480.webp')} 480w, ${url} 960w`
}

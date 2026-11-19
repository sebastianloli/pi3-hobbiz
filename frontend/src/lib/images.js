// Reduce una foto en el navegador antes de subirla: máx. 1280 px de lado y JPEG ~80 %.
// Así una foto de celular de 4 MB pasa a ~150–300 KB (el backend acepta hasta ~800 KB).
export async function resizeImage(file, { max = 1280, quality = 0.8 } = {}) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file?.type)) throw new Error('Usa una foto JPG, PNG o WebP.')
  if (file.size > 15_000_000) throw new Error('La foto es demasiado grande (máx. 15 MB).')
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error('No fue posible leer la foto.')); i.src = url })
    const scale = Math.min(1, max / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale)
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    let out = canvas.toDataURL('image/jpeg', quality)
    for (let q = quality - 0.15; out.length > 1_000_000 && q > 0.3; q -= 0.15) out = canvas.toDataURL('image/jpeg', q)
    if (out.length > 1_000_000) throw new Error('No se pudo reducir la foto lo suficiente; prueba con otra.')
    return out
  } finally { URL.revokeObjectURL(url) }
}

// Dirección del backend. En local, Vite redirige /api al puerto 3001; en producción (frontend y backend en
// dominios distintos) se define VITE_API_URL, p. ej. https://hobbiz-api.onrender.com (sin /api al final).
export const API_BASE = String(import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')

export async function request(path, { method = 'GET', body, token } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  let response
  try {
    response = await fetch(`${API_BASE}/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw Object.assign(new Error(import.meta.env.DEV
      ? 'No se pudo contactar al backend. Comprueba que npm run dev esté ejecutándose.'
      : 'No se pudo contactar al servidor de Hobbiz. Revisa tu conexión e inténtalo otra vez.'), { status: 0 })
  }
  if (response.status === 204) return null
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw Object.assign(new Error(data.error || `Error HTTP ${response.status}`), { status: response.status })
  return data
}

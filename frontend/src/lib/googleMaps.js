// Carga única de la Maps JavaScript API de Google. Requiere VITE_GOOGLE_MAPS_API_KEY en frontend/.env
// con la "Maps JavaScript API" habilitada en Google Cloud (tiene cuota mensual gratuita, pero exige
// una cuenta de facturación). Si falla la carga o la clave, MapView vuelve a Leaflet.
export const googleKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
let loading = null
let authFailed = false
const listeners = new Set()

export const onGoogleAuthFailure = (fn) => { listeners.add(fn); return () => listeners.delete(fn) }
export const googleUnavailable = () => !googleKey || authFailed

export function loadGoogleMaps() {
  if (googleUnavailable()) return Promise.reject(new Error('Google Maps no está disponible'))
  if (window.google?.maps?.Map) return Promise.resolve(window.google.maps)
  if (loading) return loading
  // Google llama a esta función global cuando la clave es inválida o no está autorizada para este dominio.
  window.gm_authFailure = () => { authFailed = true; for (const fn of listeners) fn() }
  loading = new Promise((resolve, reject) => {
    const callback = `hobbizGoogleReady${Date.now()}`
    window[callback] = () => { delete window[callback]; resolve(window.google.maps) }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?${new URLSearchParams({ key: googleKey, v: 'weekly', language: 'es', region: 'PE', loading: 'async', callback })}`
    script.async = true
    script.onerror = () => { loading = null; reject(new Error('No se pudo cargar Google Maps')) }
    document.head.appendChild(script)
  })
  return loading
}

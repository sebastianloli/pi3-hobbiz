import { reactive } from 'vue'
import { request } from './api'

export const state = reactive({
  token: sessionStorage.getItem('hobbiz-token') || '',
  user: null,
  meta: { categories: ['Arte','Cocina','Oficios','Bienestar','Otros'], districts:['Miraflores','Barranco','San Isidro','Pueblo Libre','Santiago de Surco'], images: [] },
  toast: '',
  ready: false,
  busy: false,
})

let clearToast = null
export function notify(text) {
  state.toast = text
  if (clearToast) window.clearTimeout(clearToast)
  clearToast = window.setTimeout(() => { state.toast='' }, 4100)
}
export const authRequest = (path, opts={}) => request(path, { ...opts, token: state.token })
export async function login(email, password) {
  const { token, user } = await request('/auth/login', {method:'POST',body:{email,password}})
  state.token=token
  state.user=user
  sessionStorage.setItem('hobbiz-token', token)
  return user
}
export async function register(form) {
  const {token,user} = await request('/auth/register', {method:'POST',body:form})
  state.token=token
  state.user=user
  sessionStorage.setItem('hobbiz-token',token)
  return user
}
export async function demoLogin(role='client') {
  return login(role==='instructor'?'tallerista@hobbiz.pe':'cliente@hobbiz.pe','Demo12345!')
}
export async function logout() {
  try { if(state.token) await authRequest('/auth/logout',{method:'POST'}) } catch {}
  state.token=''
  state.user=null
  sessionStorage.removeItem('hobbiz-token')
}
export async function initialize() {
  try {
    const meta = await request('/meta')
    state.meta=meta
    if (state.token) {
      try { state.user = (await authRequest('/auth/me')).user }
      catch { state.token='';sessionStorage.removeItem('hobbiz-token') }
    }
    if (!state.user) await demoLogin('client') // Experiencia de demostración inmediata.
  } catch (e) {
    notify(e.message)
  } finally {
    state.ready=true
  }
}
export function money(amount) { return `S/ ${Number(amount || 0).toFixed(0)}` }
export function dateText(date) {
  if (!date) return ''
  return new Date(`${date}T12:00:00`).toLocaleDateString('es-PE',{weekday:'long',day:'numeric',month:'short'})
}
export function niceTime(str) {
  if (!str) return ''
  const [hh, mm] = str.split(':').map(Number)
  return `${hh%12||12}:${String(mm).padStart(2,'0')} ${hh>=12?'p. m.':'a. m.'}`
}
export function demoImage(id) { return state.meta.images.includes(id) ? id : '/images/ceramica.jpg' }

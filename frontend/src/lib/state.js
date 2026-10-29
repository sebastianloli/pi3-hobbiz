import {reactive} from 'vue'
import {request} from './api'

// "Recordarme": con la casilla marcada el token vive en localStorage (sobrevive al cierre del navegador);
// sin marcarla, en sessionStorage (se borra al cerrar la pestaña). El backend también acorta su vigencia.
const store={
  read(){try{return localStorage.getItem('hobbiz-token')||sessionStorage.getItem('hobbiz-token')||''}catch{return ''}},
  write(token,remember){try{this.clear();(remember?localStorage:sessionStorage).setItem('hobbiz-token',token)}catch{}},
  remembered(){try{return !!localStorage.getItem('hobbiz-token')}catch{return false}},
  clear(){try{localStorage.removeItem('hobbiz-token');sessionStorage.removeItem('hobbiz-token')}catch{}},
}
export function rememberedEmail(){try{return localStorage.getItem('hobbiz-email')||''}catch{return ''}}
function keepEmail(email,remember){try{remember?localStorage.setItem('hobbiz-email',email):localStorage.removeItem('hobbiz-email')}catch{}}
export const state=reactive({
  token:store.read(),user:null,
  mode:'demo',
  meta:{categories:['Arte','Cerámica','Música','Escritura','Artes escénicas','Bienestar','Oficios','Otros'],districts:['Miraflores','Barranco'],districtCenters:{},districtBounds:{},images:[],accents:[],fonts:[],layouts:[]},
  ready:false,busy:false,toast:'',favoriteIds:[]
})
let clearToast
export function notify(text){state.toast=text;if(clearToast)clearTimeout(clearToast);clearToast=setTimeout(()=>state.toast='',4500)}
// Si la sesión expiró o se cerró en otra pestaña (401), se limpia y se vuelve a la pantalla de ingreso.
let onSessionLost=()=>{}
export function setSessionLostHandler(fn){onSessionLost=fn}
export const authRequest=async(path,opts={})=>{
  if(state.mode==='firebase-mongo' && state.token) await updateFirebaseToken()
  try{return await request(path,{...opts,token:state.token})}
  catch(e){
    if(e.status===401 && state.user && !path.startsWith('/auth/')){state.user=null;state.token='';state.favoriteIds=[];store.clear();e.message='Tu sesión terminó. Vuelve a iniciar sesión.';onSessionLost()}
    throw e
  }
}
export async function refreshFavorites(){if(state.user?.role!=='client'){state.favoriteIds=[];return}try{state.favoriteIds=(await authRequest('/me/favorites')).items.map(w=>w.id)}catch{}}
export async function toggleFavorite(id){const saved=state.favoriteIds.includes(id);await authRequest(`/me/favorites/${id}`,{method:saved?'DELETE':'POST'});state.favoriteIds=saved?state.favoriteIds.filter(x=>x!==id):[...state.favoriteIds,id];return !saved}
async function firebase(){return (await import('./firebase.js')).getFirebaseAuth()}
async function updateFirebaseToken(){
  const auth=await firebase()
  await auth.authStateReady()
  state.token=auth.currentUser?await auth.currentUser.getIdToken():''
  return auth
}
async function firebasePersistence(auth,remember){
  const {setPersistence,browserLocalPersistence,browserSessionPersistence}=await import('firebase/auth')
  await setPersistence(auth,remember?browserLocalPersistence:browserSessionPersistence)
}
export async function login(email,password,remember=false){
  keepEmail(email,remember)
  if(state.mode==='firebase-mongo'){
    const {signInWithEmailAndPassword}=await import('firebase/auth')
    const auth=await firebase()
    await firebasePersistence(auth,remember)
    await signInWithEmailAndPassword(auth,email,password)
    await updateFirebaseToken()
    try{const {user}=await authRequest('/auth/me');state.user=user;refreshFavorites();return user}
    catch(e){const {signOut}=await import('firebase/auth');await signOut(auth);state.token='';throw new Error(e.status===401?'Tu cuenta no tiene perfil en Hobbiz. Usa "Crear una cuenta" para completarlo.':e.message)}
  }
  const {token,user}=await request('/auth/login',{method:'POST',body:{email,password,remember}})
  state.token=token;state.user=user;store.write(token,remember);refreshFavorites();return user
}
export async function register(form,remember=false){
  keepEmail(form.email,remember)
  if(state.mode==='firebase-mongo'){
    const {createUserWithEmailAndPassword,signInWithEmailAndPassword}=await import('firebase/auth')
    const auth=await firebase()
    await firebasePersistence(auth,remember)
    try{await createUserWithEmailAndPassword(auth,form.email,form.password)}
    catch(e){if(e.code!=='auth/email-already-in-use')throw e;await signInWithEmailAndPassword(auth,form.email,form.password)}
    await updateFirebaseToken()
    const {user}=await authRequest('/account',{method:'POST',body:{name:form.name,role:form.role}})
    state.user=user;refreshFavorites();return user
  }
  const {token,user}=await request('/auth/register',{method:'POST',body:{...form,remember}})
  state.token=token;state.user=user;store.write(token,remember);refreshFavorites();return user
}
export const demoAccounts={client:'cliente@hobbiz.pe',instructor:'tallerista@hobbiz.pe',password:'Demo12345!'}
export async function logout(){
  if(state.mode==='firebase-mongo'){
    const {signOut}=await import('firebase/auth');await signOut(await firebase())
  }else{try{if(state.token)await authRequest('/auth/logout',{method:'POST'})}catch{}}
  state.token='';state.user=null;state.favoriteIds=[];store.clear()
}
export async function initialize(){
  try{
    const health=await request('/health');state.mode=health.mode
    state.meta=await request('/meta')
    if(state.mode==='firebase-mongo')await updateFirebaseToken()
    // Sin inicio de sesión automático: si no hay token válido, el router envía a /cuenta.
    // Solo se olvida la sesión recordada si el servidor la rechaza (401); ante un error de red se conserva.
    if(state.token){try{state.user=(await request('/auth/me',{token:state.token})).user}catch(e){state.user=null;if(e.status===401){state.token='';store.clear()}else notify(e.message)}}
    await refreshFavorites()
  }catch(e){notify(e.message)}finally{state.ready=true}
}
export function money(amount){return `S/ ${Number(amount||0).toFixed(0)}`}
export function dateText(date){return date?new Date(`${date}T12:00:00`).toLocaleDateString('es-PE',{weekday:'long',day:'numeric',month:'short'}):''}
export function niceTime(str){if(!str)return '';const [hh,mm]=str.split(':').map(Number);return `${hh%12||12}:${String(mm).padStart(2,'0')} ${hh>=12?'p. m.':'a. m.'}`}
export function demoImage(id){return state.meta.images.includes(id)?id:'/images/ceramica.jpg'}
export const homeFor=(user)=>user?.role==='instructor'?'/tallerista':'/'
export function whenReady(){return state.ready?Promise.resolve():new Promise(r=>{const t=setInterval(()=>{if(state.ready){clearInterval(t);r()}},20)})}

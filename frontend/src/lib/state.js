import {reactive} from 'vue'
import {request} from './api'

export const state=reactive({
  token:sessionStorage.getItem('hobbiz-token')||'',user:null,
  mode:'demo',
  meta:{categories:['Arte','Cocina','Oficios','Bienestar','Otros'],districts:['Miraflores','Barranco','San Isidro'],images:[]},
  ready:false,busy:false,toast:''
})
let clearToast
export function notify(text){state.toast=text;if(clearToast)clearTimeout(clearToast);clearToast=setTimeout(()=>state.toast='',4500)}
export const authRequest=async(path,opts={})=>{
  if(state.mode==='firebase-mongo' && state.token) await updateFirebaseToken()
  return request(path,{...opts,token:state.token})
}
async function firebase(){return (await import('./firebase.js')).getFirebaseAuth()}
async function updateFirebaseToken(){
  const auth=await firebase()
  await auth.authStateReady()
  state.token=auth.currentUser?await auth.currentUser.getIdToken():''
  if(state.token)sessionStorage.setItem('hobbiz-token',state.token)
  else sessionStorage.removeItem('hobbiz-token')
  return auth
}
export async function login(email,password){
  if(state.mode==='firebase-mongo'){
    const {signInWithEmailAndPassword}=await import('firebase/auth')
    const auth=await firebase()
    await signInWithEmailAndPassword(auth,email,password)
    await updateFirebaseToken()
    const {user}=await authRequest('/auth/me')
    state.user=user;return user
  }
  const {token,user}=await request('/auth/login',{method:'POST',body:{email,password}})
  state.token=token;state.user=user;sessionStorage.setItem('hobbiz-token',token);return user
}
export async function register(form){
  if(state.mode==='firebase-mongo'){
    const {createUserWithEmailAndPassword,signInWithEmailAndPassword}=await import('firebase/auth')
    const auth=await firebase()
    try{await createUserWithEmailAndPassword(auth,form.email,form.password)}
    catch(e){if(e.code!=='auth/email-already-in-use')throw e;await signInWithEmailAndPassword(auth,form.email,form.password)}
    await updateFirebaseToken()
    const {user}=await authRequest('/account',{method:'POST',body:{name:form.name,role:form.role}})
    state.user=user;return user
  }
  const {token,user}=await request('/auth/register',{method:'POST',body:form})
  state.token=token;state.user=user;sessionStorage.setItem('hobbiz-token',token);return user
}
export async function demoLogin(role='client'){
  if(state.mode==='firebase-mongo')throw new Error('En modo Firebase debes iniciar sesión con tu cuenta.')
  return login(role==='instructor'?'tallerista@hobbiz.pe':'cliente@hobbiz.pe','Demo12345!')
}
export async function logout(){
  if(state.mode==='firebase-mongo'){
    const {signOut}=await import('firebase/auth');await signOut(await firebase())
  }else{try{if(state.token)await authRequest('/auth/logout',{method:'POST'})}catch{}}
  state.token='';state.user=null;sessionStorage.removeItem('hobbiz-token')
}
export async function initialize(){
  try{
    const health=await request('/health');state.mode=health.mode
    state.meta=await request('/meta')
    if(state.mode==='firebase-mongo')await updateFirebaseToken()
    if(state.token){try{state.user=(await authRequest('/auth/me')).user}catch{state.user=null;if(state.mode==='demo'){state.token='';sessionStorage.removeItem('hobbiz-token')}}}
    if(!state.user && state.mode==='demo')await demoLogin('client')
  }catch(e){notify(e.message)}finally{state.ready=true}
}
export function money(amount){return `S/ ${Number(amount||0).toFixed(0)}`}
export function dateText(date){return date?new Date(`${date}T12:00:00`).toLocaleDateString('es-PE',{weekday:'long',day:'numeric',month:'short'}):''}
export function niceTime(str){if(!str)return '';const [hh,mm]=str.split(':').map(Number);return `${hh%12||12}:${String(mm).padStart(2,'0')} ${hh>=12?'p. m.':'a. m.'}`}
export function demoImage(id){return state.meta.images.includes(id)?id:'/images/ceramica.jpg'}

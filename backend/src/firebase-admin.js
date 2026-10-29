import {initializeApp, getApps, applicationDefault, cert} from 'firebase-admin/app'
import {getAuth} from 'firebase-admin/auth'
import {existsSync, readFileSync, readdirSync} from 'node:fs'
import {fileURLToPath} from 'node:url'

// Credencial de Firebase Admin. Orden de búsqueda:
// 1) GOOGLE_APPLICATION_CREDENTIALS (ruta absoluta a la cuenta de servicio, fuera de Git);
// 2) el primer .json dentro de backend/credentials/ (carpeta ignorada por .gitignore).
function credential(env) {
  if (env.GOOGLE_APPLICATION_CREDENTIALS) return applicationDefault()
  const dir = fileURLToPath(new URL('../credentials/', import.meta.url))
  const file = existsSync(dir) && readdirSync(dir).find(f => f.endsWith('.json'))
  if (!file) throw new Error('Falta la cuenta de servicio: copia el JSON en backend/credentials/ o define GOOGLE_APPLICATION_CREDENTIALS')
  return cert(JSON.parse(readFileSync(dir + file, 'utf8')))
}

export function createFirebaseVerifier(env=process.env) {
  const projectId=env.FIREBASE_PROJECT_ID
  if (!projectId) throw new Error('Falta FIREBASE_PROJECT_ID en backend/.env')
  const app=getApps().find(a=>a.name==='hobbiz-backend') || initializeApp({credential:credential(env),projectId},'hobbiz-backend')
  const auth=getAuth(app)
  // checkRevoked=true: si se cierra la sesión o se inhabilita la cuenta en Firebase, el token deja de valer.
  return token=>auth.verifyIdToken(token,true)
}

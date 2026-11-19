import {initializeApp, getApps, applicationDefault, cert} from 'firebase-admin/app'
import {getAuth} from 'firebase-admin/auth'
import {existsSync, readFileSync, readdirSync} from 'node:fs'
import {fileURLToPath} from 'node:url'

// Credencial de Firebase Admin. Orden de búsqueda:
// 1) FIREBASE_SERVICE_ACCOUNT_BASE64: el JSON de la cuenta de servicio en base64 (recomendado en Render/Railway);
// 2) FIREBASE_SERVICE_ACCOUNT_JSON: el JSON tal cual en una sola variable;
// 3) GOOGLE_APPLICATION_CREDENTIALS: ruta a un archivo (p. ej. un "Secret File" de Render);
// 4) el primer .json dentro de backend/credentials/ (desarrollo local; carpeta ignorada por .gitignore).
function credential(env) {
  const raw = env.FIREBASE_SERVICE_ACCOUNT_BASE64 ? Buffer.from(env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8') : env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (raw) {
    try { return cert(JSON.parse(raw)) } catch { throw new Error('FIREBASE_SERVICE_ACCOUNT_* no contiene un JSON válido de cuenta de servicio') }
  }
  if (env.GOOGLE_APPLICATION_CREDENTIALS) return applicationDefault()
  const dir = fileURLToPath(new URL('../credentials/', import.meta.url))
  const file = existsSync(dir) && readdirSync(dir).find(f => f.endsWith('.json'))
  if (!file) throw new Error('Falta la cuenta de servicio: define FIREBASE_SERVICE_ACCOUNT_BASE64, o copia el JSON en backend/credentials/')
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

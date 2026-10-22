import {initializeApp, getApps, applicationDefault} from 'firebase-admin/app'
import {getAuth} from 'firebase-admin/auth'
export function createFirebaseVerifier(env=process.env) {
  const projectId=env.FIREBASE_PROJECT_ID
  if (!projectId) throw new Error('Falta FIREBASE_PROJECT_ID en backend/.env')
  // GOOGLE_APPLICATION_CREDENTIALS apunta a credenciales propias, fuera de Git.
  const app=getApps().find(a=>a.name==='hobbiz-backend') || initializeApp({credential:applicationDefault(),projectId},'hobbiz-backend')
  const auth=getAuth(app)
  return token=>auth.verifyIdToken(token,true)
}

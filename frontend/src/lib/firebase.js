import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'

export function getFirebaseAuth() {
  const cfg={
    apiKey:import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain:import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId:import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId:import.meta.env.VITE_FIREBASE_APP_ID,
    messagingSenderId:import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID
  }
  if(!cfg.apiKey || !cfg.projectId || !cfg.appId) throw new Error('Completa las variables VITE_FIREBASE_* en frontend/.env')
  const app=getApps().length?getApps()[0]:initializeApp(cfg)
  return getAuth(app)
}

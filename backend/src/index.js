import dotenv from 'dotenv'
import {fileURLToPath} from 'node:url'
dotenv.config({path:fileURLToPath(new URL('../.env',import.meta.url)),quiet:true})
import {createApp} from './app.js'
import {openMongoStore} from './db.js'
import {createFirebaseVerifier} from './firebase-admin.js'

const env=process.env
const production=env.NODE_ENV==='production'
const mode=env.HOBBIZ_MODE || 'demo'
const port=Number(env.PORT || 3001)
// En la nube (Render, Railway…) hay que escuchar en 0.0.0.0; en local, solo en esta máquina.
const host=env.HOST || (production ? '0.0.0.0' : '127.0.0.1')
const list=(v)=>String(v||'').split(',').map(s=>s.trim()).filter(Boolean)
let mongo
try {
  if(!['demo','firebase-mongo'].includes(mode)) throw new Error('HOBBIZ_MODE debe ser demo o firebase-mongo')
  // El modo demo tiene contraseñas públicas y guarda todo en memoria: nunca en producción por accidente.
  if(production && mode==='demo' && env.ALLOW_DEMO!=='true') throw new Error('NODE_ENV=production exige HOBBIZ_MODE=firebase-mongo (o ALLOW_DEMO=true para una demo pública consciente).')
  if(production && mode==='firebase-mongo' && !env.CORS_ORIGIN) throw new Error('Define CORS_ORIGIN con el dominio del frontend (separa varios con comas).')
  const common={ rateLimit:env.RATE_LIMIT!=='off', trustProxy:Number(env.TRUST_PROXY ?? (production?1:0)), publicUrl:env.PUBLIC_API_URL||undefined,
    corsOrigins:env.CORS_ORIGIN?list(env.CORS_ORIGIN):undefined, adminEmails:env.ADMIN_EMAILS!==undefined?list(env.ADMIN_EMAILS):undefined }
  let app
  if(mode==='firebase-mongo') {
    const verifyIdToken=createFirebaseVerifier()
    mongo=await openMongoStore()
    app=createApp(mongo.store,{...common, mode, verifyIdToken, persistOne:mongo.persistOne, persistMany:mongo.persistMany, removeOne:mongo.removeOne})
  } else app=createApp(undefined,common)
  const server=app.listen(port,host,()=>{
    console.log(`Hobbiz API: http://${host}:${port}/api/health`)
    console.log(`Modo: ${mode}${production?' (producción)':''}`)
  })
  for(const signal of ['SIGINT','SIGTERM']) process.once(signal,async()=>{
    server.close();await mongo?.client.close();process.exit(0)
  })
}catch(e) {
  console.error('No se pudo iniciar Hobbiz:',e.message)
  if(mongo) await mongo.client.close()
  process.exitCode=1
}

import dotenv from 'dotenv'
import {fileURLToPath} from 'node:url'
dotenv.config({path:fileURLToPath(new URL('../.env',import.meta.url))})
import {createApp} from './app.js'
import {openMongoStore} from './db.js'
import {createFirebaseVerifier} from './firebase-admin.js'

const mode=process.env.HOBBIZ_MODE || 'demo'
const port=Number(process.env.PORT || 3001)
let mongo
try {
  let options={mode:'demo'}
  let store
  if(mode==='firebase-mongo') {
    const verifyIdToken=createFirebaseVerifier()
    mongo=await openMongoStore()
    store=mongo.store
    options={mode, verifyIdToken, persistOne:mongo.persistOne, removeOne:mongo.removeOne}
  } else if (mode!=='demo') throw new Error('HOBBIZ_MODE debe ser demo o firebase-mongo')
  const app=store?createApp(store,options):createApp()
  const server=app.listen(port,'127.0.0.1',()=>{
    console.log(`Hobbiz API: http://127.0.0.1:${port}/api/health`)
    console.log(`Modo: ${mode}`)
  })
  if(mongo) {
    for(const signal of ['SIGINT','SIGTERM']) process.once(signal,async()=>{
      server.close();await mongo.client.close();process.exit(0)
    })
  }
}catch(e) {
  console.error('No se pudo iniciar Hobbiz:',e.message)
  if(mongo) await mongo.client.close()
  process.exitCode=1
}

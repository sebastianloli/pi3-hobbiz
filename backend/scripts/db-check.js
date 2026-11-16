// Diagnóstico de la conexión real (no escribe nada): npm run db:check
// 1) Verifica backend/.env, 2) se conecta a MongoDB Atlas y cuenta documentos,
// 3) muestra qué cambiaría la migración automática, 4) comprueba la cuenta de servicio de Firebase.
import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
import { MongoClient } from 'mongodb'
import { planMigration } from '../src/migrate.js'
import { mongoUri } from '../src/db.js'
import { createFirebaseVerifier } from '../src/firebase-admin.js'

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) })
const env = process.env
const ok = (m) => console.log(`  ✔ ${m}`), bad = (m) => { console.log(`  ✘ ${m}`); process.exitCode = 1 }

console.log('Hobbiz · diagnóstico de base de datos\n')
console.log('1. Variables de backend/.env')
for (const k of ['HOBBIZ_MODE', 'MONGODB_URI', 'FIREBASE_PROJECT_ID']) env[k] ? ok(`${k} definido`) : bad(`${k} falta`)
console.log(`  · MONGODB_DB = ${env.MONGODB_DB || 'hobbiz (por defecto)'}`)
if (env.HOBBIZ_MODE !== 'firebase-mongo') console.log('  ! HOBBIZ_MODE no es firebase-mongo: la app seguirá en modo demo.')

console.log('\n2. MongoDB Atlas')
let client
try {
  client = new MongoClient(mongoUri(env), { serverSelectionTimeoutMS: 10000 })
  await client.connect()
  const db = client.db(env.MONGODB_DB || 'hobbiz')
  await db.command({ ping: 1 })
  ok(`Conectado a la base "${db.databaseName}"`)
  const store = {}
  for (const c of ['users', 'workshops', 'bookings', 'reviews', 'feedback']) {
    store[c] = await db.collection(c).find({}, { projection: { _id: 0 } }).toArray()
    console.log(`     ${c.padEnd(10)} ${store[c].length} documentos`)
  }
  const plan = planMigration(store, { insert: env.MONGODB_SEED_CATALOG === 'true' })
  const pending = Object.entries(plan.report).filter(([, n]) => n)
  console.log('\n3. Migración que se aplicará al arrancar (simulación)')
  if (!pending.length) ok('Nada que migrar: los datos ya tienen el formato actual.')
  const faltan = planMigration(store, { insert: true }).report
  if (faltan.seededUsers || faltan.seededWorkshops) console.log(`     ! Faltan ${faltan.seededUsers} fichas de locales y ${faltan.seededWorkshops} sesiones de ejemplo: ejecuta npm run db:seed`)
  for (const [k, n] of pending) console.log(`     ${k.padEnd(18)} ${n}`)
} catch (e) {
  bad(`No se pudo conectar: ${e.message}`)
  console.log('     Revisa usuario/contraseña, MONGODB_PASSWORD y Network Access (tu IP) en Atlas.')
} finally { await client?.close() }

console.log('\n4. Firebase Admin')
try { createFirebaseVerifier(env); ok('Cuenta de servicio cargada') } catch (e) { bad(e.message) }

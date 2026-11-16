// Carga de los locales de talleres.pdf en MongoDB (idea de la rama carga-locales-demo).
//   npm run db:seed              → aplica los cambios
//   npm run db:seed -- --dry-run → solo muestra qué haría, sin escribir
// Usa la misma lógica que el servidor (src/migrate.js), así que puede ejecutarse muchas veces:
// - inserta las fichas que falten: 24 locales con información y una sesión de ejemplo, y 11 fichas básicas;
// - completa SOLO los campos vacíos de fichas ya cargadas y no reclamadas (p. ej. por la versión anterior de este script);
// - archiva los 4 locales del PDF que están fuera de Miraflores y Barranco;
// - nunca modifica un perfil que un tallerista ya reclamó ni duplica un local con el mismo Instagram.
import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
import { MongoClient } from 'mongodb'
import { mongoUri, applyPlan } from '../src/db.js'
import { planMigration } from '../src/migrate.js'
import { venues, pendingVenues, excludedVenues } from '../src/venues.js'

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true })
const dryRun = process.argv.includes('--dry-run')
let client
try {
  client = new MongoClient(mongoUri(process.env), { serverSelectionTimeoutMS: 10000 })
  await client.connect()
  const db = client.db(process.env.MONGODB_DB || 'hobbiz')
  const store = {}
  for (const c of ['users', 'workshops', 'bookings']) store[c] = await db.collection(c).find({}, { projection: { _id: 0 } }).toArray()
  const plan = planMigration(store, { insert: true })

  console.log(`Base seleccionada: ${db.databaseName}${dryRun ? '  (simulación: no se escribe nada)' : ''}`)
  console.log(`Locales del PDF: ${venues.length + pendingVenues.length + excludedVenues.length} → ${venues.length} con información, ${pendingVenues.length} fichas básicas, ${excludedVenues.length} fuera de zona\n`)
  for (const u of plan.inserts.users) console.log(`AGREGADO   ${u.name}${u.verified === false ? ' (ficha básica)' : ''}`)
  for (const u of plan.updates.users.filter(u => u.archived && u.archivedReason === 'fuera-de-zona')) console.log(`ARCHIVADO  ${u.name} (fuera de Miraflores/Barranco)`)
  const r = plan.report
  console.log(`\nFichas nuevas: ${r.seededUsers} · Sesiones de ejemplo nuevas: ${r.seededWorkshops} · Fichas completadas: ${r.venuesEnriched} · Archivadas: ${r.venuesArchived}`)
  console.log(`Otras correcciones: talleres ${plan.updates.workshops.length}, reservas ${r.bookingsAmount}, usuarios ${r.usersFixed}`)

  if (dryRun) console.log('\nSIMULACIÓN TERMINADA: vuelve a ejecutar sin --dry-run para aplicar.')
  else { await applyPlan(db, store, plan); console.log('\nCARGA COMPLETADA') }
} catch (error) {
  console.error('\nNo se completó la carga:', error.message)
  process.exitCode = 1
} finally {
  await client?.close()
}

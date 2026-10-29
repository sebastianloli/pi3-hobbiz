import { MongoClient } from 'mongodb'
import { createSeedStore } from './data.js'
import { planMigration } from './migrate.js'

// `connect` permite inyectar un cliente simulado en las pruebas (test/mongo.test.js).
export async function openMongoStore(env=process.env, { connect = uri => new MongoClient(uri,{serverSelectionTimeoutMS:10000,maxPoolSize:5}) } = {}) {
  const template = env.MONGODB_URI
  if (!template) throw new Error('Falta MONGODB_URI en backend/.env')
  let uri = template
  for (const marker of ['<db_password>','<password>']) {
    if (uri.includes(marker)) {
      if (!env.MONGODB_PASSWORD) throw new Error(`Falta MONGODB_PASSWORD para ${marker}`)
      uri=uri.replace(marker,encodeURIComponent(env.MONGODB_PASSWORD))
    }
  }
  const client=connect(uri)
  await client.connect()
  const db=client.db(env.MONGODB_DB || 'hobbiz')
  await db.command({ping:1})
  const collections=['users','workshops','bookings','reviews','feedback']
  // Un índice que no se puede crear (p. ej. reseñas duplicadas de una versión antigua) no debe impedir el arranque.
  const index = async (c, keys, opts = {}) => {
    try { await db.collection(c).createIndex(keys, opts) }
    catch (e) { console.warn(`[mongo] No se creó el índice ${c} ${JSON.stringify(keys)}: ${e.message}`) }
  }
  for (const c of collections) await index(c, {id:1}, {unique:true})
  const store={sessions:new Map()}
  for(const c of collections) store[c]=await db.collection(c).find({}, {projection:{_id:0}}).toArray()

  // Migración automática de datos antiguos + carga de las fichas reales que falten (MONGODB_SEED_CATALOG=true).
  const plan = planMigration(store, env.MONGODB_SEED_CATALOG === 'true' ? createSeedStore() : null)
  for (const kind of ['users', 'workshops', 'bookings']) {
    const docs = plan.updates[kind]
    if (docs.length) await db.collection(kind).bulkWrite(docs.map(d => ({ replaceOne: { filter: { id: d.id }, replacement: d } })))
    for (const d of docs) Object.assign(store[kind].find(x => x.id === d.id), d)
  }
  for (const kind of ['users', 'workshops']) {
    const docs = plan.inserts[kind]
    if (docs.length) await db.collection(kind).bulkWrite(docs.map(d => ({ updateOne: { filter: { id: d.id }, update: { $setOnInsert: d }, upsert: true } })))
    store[kind].push(...docs)
  }
  const touched = Object.entries(plan.report).filter(([, n]) => n)
  if (touched.length) console.log('[mongo] Migración aplicada:', Object.fromEntries(touched))

  // Índices de consulta: catálogo por distrito/categoría/fecha, reservas por usuario y taller, una reseña por usuario y taller.
  await index('workshops', {published:1,district:1,category:1,date:1})
  await index('workshops', {instructorId:1})
  await index('bookings', {workshopId:1,status:1})
  await index('bookings', {userId:1})
  await index('reviews', {workshopId:1,userId:1}, {unique:true})
  await index('users', {email:1}, {unique:true,partialFilterExpression:{email:{$type:'string',$gt:''}}})

  const persistOne=async (kind, record) => {
    if (!collections.includes(kind)) throw new Error('Colección no permitida')
    const {_id,...safe}=record
    await db.collection(kind).replaceOne({id:record.id},safe,{upsert:true})
  }
  const removeOne=async(kind,id) => {
    if (!collections.includes(kind)) throw new Error('Colección no permitida')
    await db.collection(kind).deleteOne({id})
  }
  // De la rama de Santiago: varias filas en UNA transacción (todo o nada). Atlas, incluso el plan M0,
  // es un replica set y admite transacciones; en un mongod local sin replica set se usa un respaldo
  // que deshace lo insertado si algo falla.
  const persistMany=async(kind,records)=>{
    if (!collections.includes(kind)) throw new Error('Colección no permitida')
    if (!records.length) return
    const docs=records.map(({_id,...doc})=>doc)
    const session=client.startSession()
    try {
      await session.withTransaction(async()=>{ await db.collection(kind).insertMany(docs,{session}) })
    } catch (e) {
      if (!/Transaction numbers|replica set|IllegalOperation/i.test(e.message)) throw e
      try { await db.collection(kind).insertMany(docs,{ordered:true}) }
      catch (inner) { await db.collection(kind).deleteMany({id:{$in:docs.map(d=>d.id)}}); throw inner }
    } finally { await session.endSession() }
  }
  return {store,client,db,persistOne,persistMany,removeOne,migration:plan.report}
}

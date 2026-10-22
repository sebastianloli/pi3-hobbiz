import { MongoClient } from 'mongodb'
import { createSeedStore } from './data.js'

export async function openMongoStore(env=process.env) {
  const template = env.MONGODB_URI
  if (!template) throw new Error('Falta MONGODB_URI en backend/.env')
  let uri = template
  for (const marker of ['<db_password>','<password>']) {
    if (uri.includes(marker)) {
      if (!env.MONGODB_PASSWORD) throw new Error(`Falta MONGODB_PASSWORD para ${marker}`)
      uri=uri.replace(marker,encodeURIComponent(env.MONGODB_PASSWORD))
    }
  }
  const client=new MongoClient(uri,{serverSelectionTimeoutMS:10000,maxPoolSize:5})
  await client.connect()
  const db=client.db(env.MONGODB_DB || 'hobbiz')
  await db.command({ping:1})
  const collections=['users','workshops','bookings','reviews','feedback']
  for (const c of collections) await db.collection(c).createIndex({id:1},{unique:true})
  const store={sessions:new Map()}
  for(const c of collections) store[c]=await db.collection(c).find({}, {projection:{_id:0}}).toArray()
  // Catálogo ilustrativo, solo en una BD vacía, expresamente habilitado por el equipo.
  if (!store.workshops.length && env.MONGODB_SEED_CATALOG==='true') {
    const seed=createSeedStore()
    store.workshops=seed.workshops
    await db.collection('workshops').insertMany(store.workshops)
  }
  // No sembramos usuarios demo, reservas de ficción ni contraseñas de prueba en Firebase/Mongo.
  const persistOne=async (kind, record) => {
    if (!collections.includes(kind)) throw new Error('Colección no permitida')
    const {_id,...safe}=record
    await db.collection(kind).replaceOne({id:record.id},safe,{upsert:true})
  }
  const removeOne=async(kind,id) => {
    if (!collections.includes(kind)) throw new Error('Colección no permitida')
    await db.collection(kind).deleteOne({id})
  }
  return {store,client,db,persistOne,removeOne}
}

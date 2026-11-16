import test from 'node:test'
import assert from 'node:assert/strict'
import { openMongoStore } from '../src/db.js'
import { createApp } from '../src/app.js'
import { planMigration } from '../src/migrate.js'

// Cliente MongoDB simulado en memoria: implementa solo lo que usa db.js (find, replaceOne, bulkWrite,
// insertMany, deleteMany, createIndex y sesiones con transacción). Permite forzar fallos de escritura.
function fakeMongo(initial = {}) {
  const data = {}, indexes = []
  const state = { failNext: null, transactions: 0 }
  const col = (name) => {
    data[name] ||= (initial[name] || []).map(d => structuredClone(d))
    const rows = data[name]
    const fail = (op) => { if (state.failNext === `${name}.${op}`) { state.failNext = null; throw new Error(`fallo simulado en ${name}.${op}`) } }
    return {
      createIndex: async (keys, opts) => { indexes.push({ name, keys, opts }) },
      find: () => ({ toArray: async () => rows.map(({ _id, ...d }) => structuredClone(d)) }),
      replaceOne: async (filter, doc, opts) => { fail('replaceOne'); const i = rows.findIndex(r => r.id === filter.id); if (i >= 0) rows[i] = structuredClone(doc); else if (opts?.upsert) rows.push(structuredClone(doc)) },
      deleteOne: async (filter) => { const i = rows.findIndex(r => r.id === filter.id); if (i >= 0) rows.splice(i, 1) },
      deleteMany: async (filter) => { for (const id of filter.id.$in) { const i = rows.findIndex(r => r.id === id); if (i >= 0) rows.splice(i, 1) } },
      insertMany: async (docs, opts) => {
        fail('insertMany')
        if (opts?.session) { opts.session.pending.push(() => rows.push(...docs.map(d => structuredClone(d)))); return }
        rows.push(...docs.map(d => structuredClone(d)))
      },
      bulkWrite: async (ops) => { for (const op of ops) {
        if (op.replaceOne) { const i = rows.findIndex(r => r.id === op.replaceOne.filter.id); rows[i] = structuredClone(op.replaceOne.replacement) }
        if (op.updateOne && !rows.some(r => r.id === op.updateOne.filter.id)) rows.push(structuredClone(op.updateOne.update.$setOnInsert))
      } },
    }
  }
  const client = {
    connect: async () => {}, close: async () => {},
    db: () => ({ command: async () => ({ ok: 1 }), collection: col }),
    startSession: () => {
      const session = { pending: [],
        withTransaction: async (fn) => { state.transactions++; session.pending = []; await fn(); for (const commit of session.pending) commit() },
        endSession: async () => {} }
      return session
    },
  }
  return { client, data, indexes, state }
}
const env = { MONGODB_URI: 'mongodb+srv://u:<db_password>@x/', MONGODB_PASSWORD: 'p', MONGODB_SEED_CATALOG: 'true' }
const future = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10)

// Datos con la forma del MVP anterior y de la rama de Santiago: distritos fuera de zona, latitude/longitude, sin monto.
const legacy = () => ({
  users: [
    { id: 'uid-tallerista', name: 'Santi', email: 'santi@x.pe', role: 'instructor', preferences: { district: 'San Isidro' }, favorites: [], studio: { displayName: 'Santi', accent: 'rosa', link: 'https://santi.pe' } },
    { id: 'uid-cliente', name: 'Sebas', email: 'sebas@x.pe', role: 'client', preferences: { interests: ['Arte'], budget: 80, district: 'Miraflores', day: '' }, favorites: [] },
  ],
  workshops: [
    { id: 'old-1', instructorId: 'uid-tallerista', title: 'Linograbado', district: 'Pueblo Libre', published: true, price: 55, capacity: 8, date: future(10) },
    { id: 'old-2', instructorId: 'uid-tallerista', title: 'Cerámica', district: 'Miraflores', latitude: -12.1223, longitude: -77.0282, published: true, price: 45, capacity: 8, date: future(10) },
    { id: 'old-3', instructorId: 'uid-tallerista', title: 'Pintura', district: 'Barranco', published: true, price: 50, capacity: 8, date: future(10) },
    { id: 't-7', instructorId: 'otro-1', title: 'Semilla vieja', district: 'Miraflores', published: true, price: 60, capacity: 9, date: future(10) },
  ],
  bookings: [{ id: 'b-1', userId: 'uid-cliente', workshopId: 'old-2', seats: 2, status: 'confirmada', createdAt: '2026-10-20T00:00:00Z' }],
  reviews: [], feedback: [],
})

test('migración: oculta fuera de zona y huérfanos, renombra coordenadas, completa montos y siembra fichas reales',async()=>{
  const fake = fakeMongo(legacy())
  const mongo = await openMongoStore(env, { connect: () => fake.client })
  const w = id => fake.data.workshops.find(x => x.id === id)
  assert.equal(w('old-1').published, false); assert.equal(w('old-1').archivedReason, 'fuera-de-zona')
  assert.deepEqual([w('old-2').lat, w('old-2').lon, w('old-2').latitude], [-12.1223, -77.0282, undefined])
  assert.equal(w('old-3').locationPrecision, 'distrito')
  assert.equal(w('t-7').archivedReason, 'sin-tallerista')
  assert.equal(fake.data.bookings[0].amount, 90)
  const santi = fake.data.users.find(u => u.id === 'uid-tallerista')
  assert.equal(santi.preferences.district, 'Miraflores'); assert.equal(santi.studio.accent, 'terracota'); assert.equal(santi.studio.links.web, 'https://santi.pe')
  assert.equal(fake.data.workshops.filter(x => x.id.startsWith('w-')).length, 24)
  assert.equal(fake.data.users.filter(x => x.id.startsWith('venue-')).length, 35)
  assert.ok(fake.indexes.some(i => i.name === 'reviews' && i.opts?.unique))
  // Idempotente: una segunda pasada no encuentra nada que cambiar.
  const again = planMigration(mongo.store, { insert: true })
  assert.deepEqual(Object.values(again.report).filter(Boolean), [])
})

test('Firebase + Mongo de punta a punta: reservas, serie en transacción y memoria intacta si Atlas falla',async()=>{
  const fake = fakeMongo(legacy())
  const mongo = await openMongoStore(env, { connect: () => fake.client })
  const tokens = { 'tok-c': { uid: 'uid-cliente', email: 'sebas@x.pe' }, 'tok-t': { uid: 'uid-tallerista', email: 'santi@x.pe' } }
  const app = createApp(mongo.store, { mode: 'firebase-mongo', verifyIdToken: async t => { if (!tokens[t]) throw new Error('x'); return tokens[t] }, persistOne: mongo.persistOne, persistMany: mongo.persistMany, removeOne: mongo.removeOne })
  const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r))
  const api = async (path, { method = 'GET', token, body } = {}) => { const r = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, data: r.status === 204 ? null : await r.json() } }
  try {
    // Catálogo: solo Miraflores/Barranco; lo migrado fuera de zona no aparece.
    const list = (await api('/workshops', { token: 'tok-c' })).data.items
    assert.ok(list.every(x => ['Miraflores', 'Barranco'].includes(x.district)))
    assert.equal(list.some(x => x.id === 'old-1' || x.id === 't-7'), false)
    // Reservas simultáneas sobre el último cupo: la cola de escrituras evita la sobreventa.
    await api('/instructor/workshops/old-2', { method: 'PUT', token: 'tok-t', body: { capacity: 3, summary: 'Modelado en arcilla', description: 'Aprende modelado básico en arcilla.', category: 'Cerámica', venue: 'Taller', address: 'Calle Berlín 320', startsAt: '10:00', endsAt: '12:00', level: 'Principiante', materialsIncluded: 'Arcilla', materialsBring: 'Mandil', image: '/images/ceramica.jpg' } })
    const results = await Promise.all([1, 2, 3].map(() => api('/workshops/old-2/bookings', { method: 'POST', token: 'tok-c', body: { seats: 1 } })))
    assert.deepEqual(results.map(r => r.status).sort(), [201, 409, 409])
    assert.equal(fake.data.bookings.filter(b => b.workshopId === 'old-2').reduce((s, b) => s + b.seats, 0), 3)
    // Serie semanal: una sola transacción con las 3 sesiones.
    const before = fake.state.transactions
    const body = { title: 'Serie de prueba', summary: 'Tres sábados seguidos.', description: 'Serie semanal de prueba para la base de datos.', category: 'Arte', price: 40, district: 'Barranco', venue: 'Casa', address: 'Jr. Unión 100', lat: -12.1478, lon: -77.0212, date: future(14), startsAt: '10:00', endsAt: '12:00', capacity: 5, level: 'Principiante', materialsIncluded: 'Todo', materialsBring: 'Nada', image: '/images/arte.jpg', recurrence: 'weekly', repeatCount: 3 }
    assert.equal((await api('/instructor/workshops', { method: 'POST', token: 'tok-t', body })).status, 201)
    assert.equal(fake.state.transactions, before + 1)
    assert.equal(fake.data.workshops.filter(x => x.title === 'Serie de prueba').length, 3)
    // Si la transacción falla, no queda ninguna sesión ni en Mongo ni en memoria.
    fake.state.failNext = 'workshops.insertMany'
    assert.equal((await api('/instructor/workshops', { method: 'POST', token: 'tok-t', body: { ...body, title: 'Serie fallida' } })).status, 500)
    assert.equal(fake.data.workshops.some(x => x.title === 'Serie fallida'), false)
    assert.equal(mongo.store.workshops.some(x => x.title === 'Serie fallida'), false)
    // Escribir primero en Mongo: si Atlas falla al guardar preferencias, la memoria no cambia.
    fake.state.failNext = 'users.replaceOne'
    assert.equal((await api('/me', { method: 'PATCH', token: 'tok-c', body: { preferences: { budget: 10 } } })).status, 500)
    assert.equal((await api('/auth/me', { token: 'tok-c' })).data.user.preferences.budget, 80)
    // Los datos persisten: reabrir el "servidor" sobre la misma BD conserva reservas y talleres.
    const reopened = await openMongoStore(env, { connect: () => ({ ...fake.client }) })
    assert.equal(reopened.store.bookings.filter(b => b.workshopId === 'old-2').reduce((s, b) => s + b.seats, 0), 3)
  } finally { await new Promise(r => server.close(r)) }
})

// Base donde ya se ejecutó la versión anterior de backend/scripts/cargar-locales.mjs (rama carga-locales-demo):
// 39 perfiles vacíos con los nombres tal cual el PDF, incluidos los 4 que están fuera de zona.
const PDF = [
  ['Brilla Pe', 'Barranco', 'brilla_pe'],
  ['Blacktelier creativo', 'Barranco', 'blackateliercreativo'],
  ['Taller Magenta', 'Barranco', 'taller.magenta'],
  ['Casonatrazzo', 'Barranco', 'casonatrazzo'],
  ['Ampayyuraq', 'Barranco', 'ampayyuraq'],
  ['Kapulitelier', 'Barranco', 'kapuliatelier'],
  ['Peruacademyofart', 'Barranco', 'peruacademyofart'],
  ['Casa Infinito Perú', 'Barranco', 'casainfinitoperu'],
  ['Ultramaaar', 'Barranco', 'ultramaaar'],
  ['Lima Fuego Academy', 'Barranco', 'limafuegoacademy'],
  ['Taller 320', 'Barranco', 'taller320.barranco'],
  ['Paint and Wine Perú', 'Barranco', 'paintandwineperu'],
  ['Octava', 'Barranco', 'octava.pe'],
  ['Quincha Estudio', 'Barranco', 'quinchaestudio'],
  ['BLANLAB', 'Barranco', '_blanlab_'],
  ['Espacio 303', 'Barranco', 'espacio_303'],
  ['Academia Aidem', 'Barranco', 'aidem_musica_barranco'],
  ['Samaca Artes y Letras', 'Barranco', 'samacaartesyletras'],
  ['Barranqueando', 'Barranco', 'somosbarranqueando'],
  ['Studio Rock', 'Miraflores', 'studiorock.pe'],
  ['Taller de escritura creativa', 'Miraflores', 'tallerdeescrituracreativa'],
  ['El Embarre', 'Miraflores', 'elembarretaller'],
  ['Spazio', 'Miraflores', 'spaziostudio.pe'],
  ['Wegner', 'Miraflores', 'wagnertalleresdearte'],
  ['Terra Point', 'Miraflores', 'terrapoint.pe'],
  ['PLAM', 'Miraflores', 'plamoficial'],
  ['Urban Coffee', 'Miraflores', 'urbancoffeeperu'],
  ['El Taller', 'Miraflores', 'eltaller.espacio'],
  ['Taller Forns', 'Miraflores', 'taller_forns'],
  ['MiCoAcuarlaIlustracion', 'Miraflores', 'milagros_contreras_mi_co'],
  ['Mundo de Barro', 'Miraflores', 'mundodebarro'],
  ['Rima con Lima', 'Miraflores', 'rimaconlima'],
  ['Arte para crecer', 'Miraflores', 'arteparacrecer'],
  ['Puerta Roja', 'Miraflores', 'lapuertarojataller'],
  ['Club de Teatro de Lima', 'Miraflores', 'clubdeteatrodelima'],
  ['Workshop', 'Miraflores', 'workshop.centroartistico'],
  ['LMS | Escuela de Técnica Vocal y Música', 'Miraflores', 'limamusicstudio'],
  ['Guitarra Lima Academy', 'Miraflores', 'guitarralima.academy'],
  ['Sibelius Academia', 'Miraflores', 'sibelius.pe']
]
const perfilVacio = ([name, district, handle]) => ({ id: `venue-${handle.replace(/[^a-z0-9]+/gi, '-')}`, name, email: '', role: 'instructor', claimed: false,
  preferences: { interests: [], budget: 0, district, day: '' }, favorites: [], importSource: 'talleres.pdf',
  studio: { displayName: name, tagline: '', bio: '', link: '', links: { instagram: `https://www.instagram.com/${handle}/` }, accent: 'terracota', accentColor: '', font: 'moderna', layout: 'portada', coverImage: '', gallery: [], district, address: '' } })

test('carga-locales-demo: completa fichas vacías, corrige nombres, archiva fuera de zona y agrega sesiones sin duplicar',async()=>{
  const reclamado = { ...perfilVacio(['Mundo de Barro', 'Miraflores', 'mundodebarro']), claimed: true, studio: { displayName: 'Mundo de Barro (oficial)', bio: '', links: { instagram: 'https://www.instagram.com/mundodebarro/' } } }
  const otroId = { ...perfilVacio(['Casona', 'Barranco', 'casonatrazzo']), id: 'uid-casona' }
  const users = [...PDF.filter(([, , h]) => h !== 'mundodebarro' && h !== 'casonatrazzo').map(perfilVacio), reclamado, otroId]
  const fake = fakeMongo({ users, workshops: [], bookings: [], reviews: [], feedback: [] })
  const mongo = await openMongoStore({ ...env, MONGODB_SEED_CATALOG: 'true' }, { connect: () => fake.client })
  const u = id => fake.data.users.find(x => x.id === id)
  // Datos investigados en las fichas vacías; nombres del PDF corregidos.
  assert.ok(u('venue-wagnertalleresdearte').studio.bio.length > 20)
  assert.equal(u('venue-wagnertalleresdearte').name, 'Wagner Talleres de Arte')
  assert.equal(u('venue-milagros-contreras-mi-co').name, 'MiCo Acuarela & Ilustración')
  assert.ok(u('venue-peruacademyofart').studio.coverImage)
  // Los 4 de fuera de zona quedan archivados.
  for (const id of ['venue-taller-magenta', 'venue-ampayyuraq', 'venue-lapuertarojataller', 'venue-workshop-centroartistico']) assert.equal(u(id).archived, true, id)
  // Un perfil reclamado no se toca, aunque tenga campos vacíos.
  assert.deepEqual([u('venue-mundodebarro').studio.displayName, u('venue-mundodebarro').studio.bio, u('venue-mundodebarro').studio.coverImage, u('venue-mundodebarro').name], ['Mundo de Barro (oficial)', '', undefined, 'Mundo de Barro'])
  // Mismo Instagram con otro id: no se duplica, y la sesión de ejemplo se asigna a ese perfil.
  assert.equal(fake.data.users.filter(x => (x.studio?.links?.instagram || '').includes('casonatrazzo')).length, 1)
  assert.equal(fake.data.workshops.find(w => w.id === 'w-casonatrazzo').instructorId, 'uid-casona')
  assert.equal(fake.data.workshops.length, 24)
  assert.equal(fake.data.users.length, 39)
  // Fichas básicas: sin información verificada, sin sesiones.
  assert.equal(u('venue-taller320-barranco').verified, false)
  // Idempotente.
  assert.deepEqual(Object.values(planMigration(mongo.store, { insert: true }).report).filter(Boolean), [])

  // Directorio: muestra fichas con y sin sesiones, nunca las archivadas.
  const app = createApp(mongo.store, { mode: 'firebase-mongo', verifyIdToken: async () => ({ uid: 'venue-mundodebarro', email: 'x@x.pe' }) })
  const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r))
  const get = async (path) => (await (await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { headers: { Authorization: 'Bearer t' } })).json())
  try {
    const all = (await get('/instructors')).items
    assert.equal(all.length, 35)
    assert.equal(all.some(x => x.id === 'venue-taller-magenta'), false)
    assert.ok(all.find(x => x.id === 'venue-taller320-barranco' && x.workshopCount === 0 && !x.verified))
    assert.ok((await get('/instructors?district=Barranco')).items.every(x => x.district === 'Barranco'))
    assert.ok((await get('/instructors?q=ceramica')).items.length >= 1)
    const archived = await fetch(`http://127.0.0.1:${server.address().port}/api/instructors/venue-ampayyuraq`, { headers: { Authorization: 'Bearer t' } })
    assert.equal(archived.status, 404)
  } finally { await new Promise(r => server.close(r)) }
})

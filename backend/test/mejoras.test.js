import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createApp } from '../src/app.js'
import { createSeedStore } from '../src/data.js'
import { planMigration } from '../src/migrate.js'

// Correcciones de la revisión de seguridad, errores y despliegue (19/11/2026) y verificación de talleristas.
const future = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10)
const todayLima = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10)
async function withApi(fn, { store = createSeedStore(), options = {} } = {}) {
  const server = createApp(store, options).listen(0, '127.0.0.1')
  await new Promise(r => server.once('listening', r))
  const url = `http://127.0.0.1:${server.address().port}/api`
  const api = async (path, { method = 'GET', token, body, headers = {} } = {}) => {
    const r = await fetch(url + path, { method, headers: { ...headers, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined })
    const type = r.headers.get('content-type') || ''
    return { status: r.status, headers: r.headers, data: r.status === 204 ? null : type.includes('json') ? await r.json() : Buffer.from(await r.arrayBuffer()) }
  }
  const login = async (email) => (await api('/auth/login', { method: 'POST', body: { email, password: 'Demo12345!' } })).data.token
  try { await fn(api, login, store, url) } finally { await new Promise(r => server.close(r)) }
}
const draft = (over = {}) => ({ title: 'Mosaico', summary: 'Arte con teselas.', description: 'Crea una composición decorativa paso a paso.', category: 'Arte', price: 50, district: 'Miraflores', venue: 'Taller X', address: 'Av. Larco 400', lat: -12.1209, lon: -77.0296, date: future(20), startsAt: '10:00', endsAt: '12:00', capacity: 10, level: 'Principiante', materialsIncluded: 'Teselas', materialsBring: 'Mandil', image: '/images/arte.jpg', ...over })
// JPEG mínimo válido (1x1) como data URI.
const PIXEL = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q=='

test('seguridad: límite de intentos de login, cabeceras y CORS por lista', () => withApi(async (api) => {
  assert.equal((await api('/auth/login', { method: 'POST', body: { email: { toString: 1 }, password: 'x' } })).status, 400)
  for (let i = 0; i < 9; i++) assert.equal((await api('/auth/login', { method: 'POST', body: { email: 'cliente@hobbiz.pe', password: 'mala' } })).status, 401)
  const blocked = await api('/auth/login', { method: 'POST', body: { email: 'cliente@hobbiz.pe', password: 'mala' } })
  assert.equal(blocked.status, 429)
  assert.match(blocked.data.error, /Demasiados intentos/)
  const h = await api('/health', { headers: { Origin: 'https://b.vercel.app' } })
  assert.equal(h.headers.get('x-content-type-options'), 'nosniff')
  assert.equal(h.headers.get('access-control-allow-origin'), 'https://b.vercel.app')
  const other = await api('/health', { headers: { Origin: 'https://malicioso.example' } })
  assert.equal(other.headers.get('access-control-allow-origin'), null)
}, { options: { rateLimit: true, corsOrigins: ['https://a.vercel.app', 'https://b.vercel.app'] } }))

test('imágenes: el JSON lleva una URL corta, la imagen se sirve aparte y la URL no reemplaza al original', () => withApi(async (api, login, store) => {
  const t = await login('tallerista@hobbiz.pe')
  const made = await api('/instructor/workshops', { method: 'POST', token: t, body: draft({ image: PIXEL }) })
  assert.equal(made.status, 201)
  assert.match(made.data.item.image, /\/api\/images\/w\/[^?]+\?v=/)
  const img = await api(new URL(made.data.item.image).pathname.replace('/api', ''))
  assert.equal(img.headers.get('content-type'), 'image/jpeg')
  assert.ok(img.data.length > 100)
  // Al editar, el formulario devuelve la URL: se conserva la foto original guardada.
  await api(`/instructor/workshops/${made.data.item.id}`, { method: 'PUT', token: t, body: { ...made.data.item, price: 60 } })
  assert.equal(store.workshops.find(w => w.id === made.data.item.id).image, PIXEL)
  // El catálogo ya no viaja con base64.
  const c = await login('cliente@hobbiz.pe')
  assert.equal(JSON.stringify((await api('/workshops', { token: c })).data).includes('base64'), false)
  assert.equal((await api('/images/w/no-existe')).status, 404)
}))

test('datos de negocio: el monto recaudado solo lo ve su tallerista', () => withApi(async (api, login) => {
  const c = await login('cliente@hobbiz.pe'), t = await login('tallerista@hobbiz.pe')
  assert.equal((await api('/workshops/t-1', { token: c })).data.item.estimatedGross, undefined)
  assert.ok((await api('/workshops/t-1', { token: t })).data.item.estimatedGross > 0)
}))

test('reservas: tope por persona, cancelar libera cupos y no se reserva lo que ya empezó', () => withApi(async (api, login, store) => {
  const c = await login('cliente@hobbiz.pe')
  const before = (await api('/workshops/t-3', { token: c })).data.item.available
  const b = await api('/workshops/t-3/bookings', { method: 'POST', token: c, body: { seats: 3 } })
  assert.equal(b.status, 201)
  assert.equal((await api('/workshops/t-3/bookings', { method: 'POST', token: c, body: { seats: 3 } })).status, 409)
  assert.equal((await api('/workshops/t-3/bookings', { method: 'POST', token: c, body: { seats: '2' } })).status, 400)
  const cancel = await api(`/me/bookings/${b.data.item.id}/cancel`, { method: 'POST', token: c })
  assert.equal(cancel.status, 200)
  assert.equal(cancel.data.workshop.available, before)
  assert.equal((await api(`/me/bookings/${b.data.item.id}/cancel`, { method: 'POST', token: c })).status, 409)
  // Una reserva ajena no se puede cancelar.
  assert.equal((await api('/me/bookings/sample-0/cancel', { method: 'POST', token: c })).status, 404)
  // Taller de hoy que ya empezó: no admite reservas ni aparece en el catálogo.
  store.workshops.push({ ...store.workshops.find(w => w.id === 't-3'), id: 'hoy', date: todayLima(), startsAt: '00:00', endsAt: '00:01' })
  assert.equal((await api('/workshops/hoy/bookings', { method: 'POST', token: c, body: { seats: 1 } })).status, 409)
  assert.equal((await api('/workshops', { token: c })).data.items.some(w => w.id === 'hoy'), false)
  const mine = (await api('/me/bookings', { token: c })).data.items
  assert.equal(mine.find(x => x.id === b.data.item.id).cancellable, false)
  assert.equal(mine.find(x => x.id === 'r-2').cancellable, true)
}))

test('talleres ocultos: los ve su tallerista y quien los reservó; nadie más', () => withApi(async (api, login) => {
  const t = await login('tallerista@hobbiz.pe'), c = await login('cliente@hobbiz.pe')
  await api('/instructor/workshops/t-1', { method: 'PUT', token: t, body: { published: false } })
  assert.equal((await api('/workshops/t-1', { token: t })).status, 200)
  assert.equal((await api('/workshops/t-1', { token: c })).status, 200)   // cliente-1 tiene reserva
  const otro = (await api('/auth/register', { method: 'POST', body: { name: 'Otra Persona', email: 'otra@x.pe', password: 'Clave12345', role: 'client' } })).data.token
  assert.equal((await api('/workshops/t-1', { token: otro })).status, 404)
}))

test('validación estricta de tipos al crear talleres', () => withApi(async (api, login) => {
  const t = await login('tallerista@hobbiz.pe')
  for (const bad of [{ price: '' }, { price: null }, { price: true }, { capacity: true }, { capacity: 2.5 }, { recurrence: 'weekly', repeatCount: '' }, { recurrence: 'weekly', repeatCount: 1 }, { date: todayLima(), startsAt: '00:00', endsAt: '00:30' }])
    assert.equal((await api('/instructor/workshops', { method: 'POST', token: t, body: draft(bad) })).status, 400, JSON.stringify(bad))
  assert.equal((await api('/instructor/workshops', { method: 'POST', token: t, body: draft({ price: '45', capacity: '8' }) })).status, 201)
}))

test('reseñas públicas: nombre abreviado y sin identificadores internos, también en la página del estudio', () => withApi(async (api, login) => {
  const c = await login('cliente@hobbiz.pe')
  await api('/me', { method: 'PATCH', token: c, body: { name: 'Gabriela Fernández Quispe' } })
  await api('/workshops/t-0/reviews', { method: 'POST', token: c, body: { stars: 5, comment: 'Excelente sesión de collage' } })
  const studio = (await api('/instructors/tallerista-1', { token: c })).data.item
  const r = studio.reviews.find(x => x.workshopId === 't-0')
  assert.equal(r.name, 'Gabriela F.')
  assert.equal(r.userId, undefined)
  assert.equal(JSON.stringify(studio).includes('Fernández Quispe'), false)
}))

test('verificación de talleristas: en revisión → solicitud → aprobación con traspaso del local', () => withApi(async (api, login, store) => {
  const reg = await api('/auth/register', { method: 'POST', body: { name: 'Lucía Barro', email: 'lucia@x.pe', password: 'Clave12345', role: 'instructor' } })
  const t = reg.data.token
  assert.equal(reg.data.user.instructorStatus, 'pending')
  // En revisión: puede personalizar su perfil, pero no publicar.
  assert.equal((await api('/instructor/studio', { method: 'PATCH', token: t, body: { displayName: 'Lucía Barro' } })).status, 200)
  const blocked = await api('/instructor/workshops', { method: 'POST', token: t, body: draft() })
  assert.equal(blocked.status, 403)
  assert.match(blocked.data.error, /en revisión/)
  // No aparece en el directorio ni su perfil es público todavía.
  const c = await login('cliente@hobbiz.pe')
  assert.equal((await api(`/instructors/${reg.data.user.id}`, { token: c })).status, 404)
  // Solicitud: reclama la ficha de Casona Trazzo.
  assert.equal((await api('/instructor/verification', { method: 'POST', token: t, body: { claimVenueId: 'venue-no-existe', message: 'Somos el taller real.' } })).status, 404)
  const req = await api('/instructor/verification', { method: 'POST', token: t, body: { claimVenueId: 'venue-casonatrazzo', message: 'Soy la encargada de Casona Trazzo.', contact: '@casonatrazzo' } })
  assert.equal(req.data.user.verificationRequest.claimVenueName, 'Casona Trazzo')
  // Solo el equipo puede aprobar.
  assert.equal((await api('/admin/instructors', { token: c })).status, 403)
  const a = await login('admin@hobbiz.pe')
  const pending = (await api('/admin/instructors', { token: a })).data.items
  assert.ok(pending.some(x => x.email === 'lucia@x.pe') && pending.some(x => x.email === 'nuevo@hobbiz.pe'))
  const ok = await api(`/admin/instructors/${reg.data.user.id}/approve`, { method: 'POST', token: a, body: { transferVenue: true } })
  assert.equal(ok.status, 200)
  assert.equal(ok.data.transferredWorkshops, 1)
  // El local reclamado pasa a su cuenta; la ficha antigua se archiva.
  assert.equal(store.workshops.find(w => w.id === 'w-casonatrazzo').instructorId, reg.data.user.id)
  assert.equal((await api('/instructors/venue-casonatrazzo', { token: c })).status, 404)
  const pub = (await api(`/instructors/${reg.data.user.id}`, { token: c })).data.item
  assert.equal(pub.studio.displayName, 'Lucía Barro')
  assert.ok(pub.studio.bio.length > 20)   // completado con la ficha del local
  assert.equal((await api('/instructor/workshops', { method: 'POST', token: t, body: draft() })).status, 201)
  // Rechazo con motivo.
  const reject = await api('/admin/instructors/tallerista-2/reject', { method: 'POST', token: a, body: { reason: 'No pudimos confirmar el local.' } })
  assert.equal(reject.data.item.instructorStatus, 'rejected')
  assert.ok((await api('/admin/feedback', { token: a })).data.items)
}))

test('Firebase: correo sin verificar no reserva ni pide aprobación; el rol no se cambia en silencio', async () => {
  const store = createSeedStore()
  const tokens = {
    nuevo: { uid: 'uid-n', email: 'Nuevo@X.pe', email_verified: false },
    verificado: { uid: 'uid-n', email: 'nuevo@x.pe', email_verified: true },
    duplicado: { uid: 'uid-otro', email: 'nuevo@x.pe', email_verified: true },
    admin: { uid: 'admin-1', email: 'admin@hobbiz.pe', email_verified: false },
  }
  await withApi(async (api) => {
    const acc = await api('/account', { method: 'POST', token: 'nuevo', body: { name: 'Nuevo Cliente', role: 'client' } })
    assert.equal(acc.data.user.email, 'nuevo@x.pe')
    assert.equal(acc.data.user.emailVerified, false)
    const b = await api('/workshops/t-3/bookings', { method: 'POST', token: 'nuevo', body: { seats: 1 } })
    assert.equal(b.status, 403)
    assert.match(b.data.error, /Verifica tu correo/)
    // Tras verificar el correo (token renovado), ya puede reservar.
    assert.equal((await api('/workshops/t-3/bookings', { method: 'POST', token: 'verificado', body: { seats: 1 } })).status, 201)
    // Mismo correo con otro rol: aviso explícito, no inicio de sesión con el rol anterior.
    assert.equal((await api('/account', { method: 'POST', token: 'verificado', body: { name: 'Nuevo', role: 'instructor' } })).status, 409)
    // Otra cuenta de Firebase con el mismo correo: 409 claro (no "token inválido").
    assert.equal((await api('/account', { method: 'POST', token: 'duplicado', body: { name: 'Otro', role: 'client' } })).status, 409)
    // Un correo de administración sin verificar no tiene permisos de administración.
    assert.equal((await api('/admin/instructors', { token: 'admin' })).status, 403)
  }, { store, options: { mode: 'firebase-mongo', adminEmails: ['admin@hobbiz.pe'], verifyIdToken: async (t) => { if (!tokens[t]) throw new Error('x'); return tokens[t] } } })
})

test('panel del tallerista: los talleres pasados no cuentan como activos', () => withApi(async (api, login) => {
  const t = await login('tallerista@hobbiz.pe')
  const d = (await api('/instructor/dashboard', { token: t })).data
  assert.equal(d.byWorkshop.find(x => x.id === 't-0').past, true)
  assert.equal(d.activeWorkshops, d.byWorkshop.filter(x => !x.past).length)
}))

test('migración: renueva sesiones de ejemplo vencidas sin reservas y aprueba talleristas existentes', () => {
  const store = createSeedStore()
  const w = store.workshops.find(x => x.id === 'w-casonatrazzo')
  w.date = '2026-01-03'   // sábado, ya pasado
  store.workshops.find(x => x.id === 't-0').sampleData = true   // pasado pero con reserva: no se toca
  delete store.users.find(u => u.id === 'tallerista-1').instructorStatus
  const plan = planMigration(store)
  const moved = plan.updates.workshops.find(x => x.id === 'w-casonatrazzo')
  assert.ok(moved.date >= todayLima())
  assert.equal(new Date(`${moved.date}T12:00:00Z`).getUTCDay(), 6)
  assert.equal(plan.updates.workshops.some(x => x.id === 't-0'), false)
  assert.equal(plan.updates.users.find(u => u.id === 'tallerista-1').instructorStatus, 'approved')
  assert.equal(plan.updates.users.some(u => u.id === 'tallerista-2'), false)   // pendiente: se respeta
})

test('arranque: en producción no inicia en modo demo ni sin CORS_ORIGIN', () => {
  const index = fileURLToPath(new URL('../src/index.js', import.meta.url))
  const run = (env) => spawnSync(process.execPath, [index], { env: { PATH: process.env.PATH, ...env }, encoding: 'utf8', timeout: 20000 })
  const demo = run({ NODE_ENV: 'production' })
  assert.equal(demo.status, 1)
  assert.match(demo.stderr, /exige HOBBIZ_MODE=firebase-mongo/)
  const cors = run({ NODE_ENV: 'production', HOBBIZ_MODE: 'firebase-mongo' })
  assert.equal(cors.status, 1)
  assert.match(cors.stderr, /CORS_ORIGIN/)
})

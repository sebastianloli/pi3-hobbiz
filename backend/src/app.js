import express from 'express'
import cors from 'cors'
import { randomUUID, timingSafeEqual, scryptSync } from 'node:crypto'
import { categories, createSeedStore, districts, districtBounds, districtAreas, insideArea, isDistrict, hashPassword, imageNames, accents, fonts, layouts } from './data.js'

const safeUser = ({ passwordHash, ...user }) => user
// Sin tildes ni mayúsculas: "ceramica" encuentra "Cerámica".
const normalize = (s) => String(s ?? '').trim().toLocaleLowerCase('es-PE').normalize('NFD').replace(/\p{Diacritic}/gu, '')
const round = (n) => Math.round(n * 10) / 10
const within = (n, min, max) => Number.isFinite(n) && n >= min && n <= max
// Fecha de hoy en Lima (UTC-5, sin horario de verano).
const todayLima = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10)
const bookingAmount = (b, w) => Number.isFinite(b.amount) ? b.amount : b.seats * (w?.price || 0)
const seatsBooked = (store, id) => store.bookings.filter(b => b.workshopId === id && b.status === 'confirmada').reduce((sum,b) => sum + b.seats, 0)
// Nombre público de quien reseña: nombre + inicial del apellido, siempre con el nombre actual del perfil.
const displayName = (store, r) => { const u = store.users.find(x => x.id === r.userId); if (!u) return r.name; const [first, last] = u.name.trim().split(/\s+/); return last ? `${first} ${last[0]}.` : first }
const feedback = (store, id) => store.reviews.filter(r => r.workshopId === id)
const enrich = (store, workshop) => {
  const reviews = feedback(store, workshop.id)
  const taken = seatsBooked(store, workshop.id)
  const owner = store.users.find(u => u.id===workshop.instructorId)
  // El monto recaudado suma el importe guardado en cada reserva (precio al momento de reservar).
  const gross = store.bookings.filter(b => b.workshopId === workshop.id && b.status === 'confirmada').reduce((s, b) => s + bookingAmount(b, workshop), 0)
  return { ...workshop, enrollmentOpen: workshop.enrollmentOpen !== false, past: workshop.date < todayLima(), reserved: taken, available: Math.max(0, workshop.capacity - taken), estimatedGross: gross, rating: reviews.length ? round(reviews.reduce((s,v)=>s+v.stars,0)/reviews.length) : null, reviewCount: reviews.length, instructorName: owner?.studio?.displayName || owner?.name || 'Tallerista de Hobbiz', instructorStudio: owner?.studio || null, instructorClaimed: owner?.claimed !== false }
}
const distanceKm = (a,b) => {
  const radians = v => (v*Math.PI)/180
  const dlat = radians(b[0]-a[0]), dlon=radians(b[1]-a[1])
  const x = Math.sin(dlat/2)**2 + Math.cos(radians(a[0]))*Math.cos(radians(b[0]))*Math.sin(dlon/2)**2
  return 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))
}
const getAuth = (req, store) => {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  const session = store.sessions.get(token)
  if (!session) return null
  // Compatibilidad: sesiones antiguas guardadas como userId plano.
  const { userId, expiresAt } = typeof session === 'string' ? { userId: session, expiresAt: Infinity } : session
  if (expiresAt < Date.now()) { store.sessions.delete(token); return null }
  return store.users.find(u => u.id===userId) || null
}
const error = (res, code, message) => res.status(code).json({ error: message })
// "Recordarme": 30 días; sin marcar, la sesión dura 8 horas (además el frontend la guarda solo en sessionStorage).
export const SESSION_TTL = { remember: 30 * 24 * 3600 * 1000, short: 8 * 3600 * 1000 }
const openSession = (store, userId, remember) => {
  const token = randomUUID()
  const ttl = remember ? SESSION_TTL.remember : SESSION_TTL.short
  store.sessions.set(token, { userId, expiresAt: Date.now() + ttl })
  return { token, expiresAt: new Date(Date.now() + ttl).toISOString() }
}
const insideDistrict = insideArea
const timeSlot = (hhmm) => hhmm < '12:00' ? 'mañana' : hhmm < '18:00' ? 'tarde' : 'noche'
const HTTPS_URL = /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(?:[\/?#][^\s<>"']*)?$/i
const requireAuth = (store, role, options) => async (req, res, next) => {
  try {
    if (options.mode === 'firebase-mongo') {
      const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
      if (!token) return error(res, 401, 'Inicia sesión para continuar.')
      const identity = await options.verifyIdToken(token)
      req.user = store.users.find(u => u.id === identity.uid) || null
    } else {
      req.user = getAuth(req, store)
    }
    if (!req.user) return error(res,401,'Completa tu perfil o inicia sesión.')
    if (role && req.user.role !== role) return error(res,403,'No tienes permisos para realizar esta acción.')
    next()
  } catch { return error(res,401,'La sesión no es válida. Vuelve a ingresar.') }
}

function checkPassword(password, digest) {
  const [salt, expected] = String(digest).split(':')
  if (!salt || !expected) return false
  const actual = scryptSync(String(password), salt, 64)
  const exp = Buffer.from(expected, 'hex')
  return actual.length === exp.length && timingSafeEqual(actual, exp)
}
function validImage(source) {
  if (typeof source !== 'string') return false
  if (/^\/images\/[a-z0-9-]+\.(jpg|svg)$/i.test(source)) return imageNames.includes(source.split('/').at(-1))
  if (HTTPS_URL.test(source)) return source.length <= 500
  return /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(source) && source.length < 1_600_000
}
// Compatibilidad con la rama de Santiago, que enviaba latitude/longitude en vez de lat/lon.
function coords(p) {
  if (p.lat === undefined && p.latitude !== undefined) p.lat = p.latitude
  if (p.lon === undefined && p.longitude !== undefined) p.lon = p.longitude
  delete p.latitude; delete p.longitude
  return p
}
function validateWorkshop(p) {
  coords(p)
  const required = ['title','summary','description','category','district','venue','address','date','startsAt','endsAt','level','materialsIncluded','materialsBring','image']
  for (const field of required) if (typeof p[field] !== 'string' || !p[field].trim()) return `Completa el campo obligatorio: ${field}.`
  if (!categories.includes(p.category)) return 'La categoría no es válida.'
  if (!isDistrict(p.district)) return 'Selecciona Miraflores o Barranco.'
  if (!within(Number(p.price), 0, 9999)) return 'El precio debe ser un número entre 0 y 9999.'
  if (!Number.isInteger(Number(p.capacity)) || !within(Number(p.capacity), 1, 1000)) return 'Los cupos deben ser un entero entre 1 y 1000.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date) || Number.isNaN(Date.parse(p.date)) || new Date(`${p.date}T12:00:00Z`).toISOString().slice(0,10) !== p.date) return 'La fecha no es válida.'
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.startsAt) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.endsAt) || p.startsAt >= p.endsAt) return 'Indica un horario válido.'
  if (!validImage(p.image)) return 'Selecciona una foto válida (galería, enlace HTTPS o JPG/PNG/WebP de hasta 1 MB).'
  if (!within(Number(p.lat), -90, 90) || !within(Number(p.lon), -180, 180)) return 'Marca la ubicación del taller en el mapa.'
  if (!insideDistrict(p.district, Number(p.lat), Number(p.lon))) return `El punto del mapa debe estar dentro de ${p.district}.`
  return null
}
const publicWorkshop = (store, id) => {
  const found = store.workshops.find(w => w.id === id)
  return found ? enrich(store, found) : null
}

export function createApp(store = createSeedStore(), options = {}) {
  const mode = options.mode || 'demo'
  const persistent = mode === 'firebase-mongo'
  // Regla de escritura (rama avance-santiago-semana11): primero se guarda en MongoDB y recién
  // después se modifica la copia en memoria; si Atlas falla, la memoria no queda desincronizada.
  const persist = async (kind, record) => { if (options.persistOne) await options.persistOne(kind, record) }
  // Varias filas a la vez (series semanales): con MongoDB se insertan en una transacción, todo o nada.
  const persistAll = async (kind, records) => {
    if (options.persistMany) return options.persistMany(kind, records)
    for (const record of records) await persist(kind, record)
  }
  const removePersisted = async (kind, id) => { if (options.removeOne) await options.removeOne(kind, id) }

  const app = express()
  app.disable('x-powered-by')
  app.use(cors({ origin: process.env.CORS_ORIGIN || (persistent ? 'http://localhost:5173' : true) }))
  app.use(express.json({ limit: '2mb' }))
  // Cola de escrituras (idea de la rama de Santiago): las peticiones que modifican datos se atienden de
  // una en una, así dos reservas simultáneas no pueden vender el mismo cupo. Válido para UNA instancia.
  let mutationTail = Promise.resolve()
  app.use('/api', (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
    const previous = mutationTail
    let release
    mutationTail = new Promise(resolve => { release = resolve })
    res.once('close', release)
    previous.then(() => next(), next)
  })
  const auth = requireAuth(store, undefined, options)
  const instructor = requireAuth(store, 'instructor', options)
  const client = requireAuth(store, 'client', options)

  app.get('/api/health', (_req,res) => res.json({ status: 'ok', mode, version:'2.0.0' }))
  app.get('/api/meta', (_req,res) => res.json({ categories, districts: Object.keys(districts), districtCenters: districts, districtBounds, districtAreas, images: imageNames.map(i => `/images/${i}`), accents, fonts, layouts }))

  app.post('/api/auth/login', (req,res) => {
    if (persistent) return error(res, 409, 'Usa Firebase Authentication para acceder.')
    const { email='', password='', remember=false } = req.body || {}
    const user = store.users.find(u => normalize(u.email) === normalize(email))
    if (!user || !user.passwordHash || !checkPassword(password, user.passwordHash)) return error(res,401,'Credenciales incorrectas.')
    res.json({ ...openSession(store, user.id, remember === true), user: safeUser(user) })
  })
  app.post('/api/auth/register', (req,res) => {
    if (persistent) return error(res, 409, 'Usa Firebase Authentication para registrarte.')
    const { name='', email='', password='', role='client', remember=false } = req.body || {}
    if ([name,email,password].some(v => typeof v !== 'string') || name.trim().length > 100 || !password.trim()) return error(res,400,'Revisa nombre, correo y contraseña.')
    if (String(name).trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) return error(res,400,'Ingresa nombre y correo válido.')
    if (String(password).length < 8) return error(res,400,'La contraseña debe tener al menos 8 caracteres.')
    if (!['client','instructor'].includes(role)) return error(res,400,'Tipo de cuenta inválido.')
    if (store.users.some(u => normalize(u.email) === normalize(email))) return error(res,409,'El correo ya está registrado.')
    const user = { id:randomUUID(), name:String(name).trim(), email:String(email).trim().toLowerCase(), passwordHash: hashPassword(password), role, preferences:{ interests:[], budget:100, district:'Miraflores', day:'' },favorites:[] }
    store.users.push(user)
    res.status(201).json({ ...openSession(store, user.id, remember === true), user:safeUser(user) })
  })
  app.post('/api/auth/logout', auth, (req,res) => { if (!persistent) store.sessions.delete(req.headers.authorization.replace(/^Bearer\s+/i,'')); res.status(204).end() })
  // Identidad única: un token Firebase verificado representa al mismo usuario en TODOS los endpoints.
  app.post('/api/account', async (req, res, next) => {
    if (!persistent) return error(res, 409, 'Disponible al configurar Firebase + MongoDB.')
    try {
      const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
      if (!bearer) return error(res, 401, 'Se requiere un token Firebase.')
      const identity = await options.verifyIdToken(bearer)
      const { name, role } = req.body || {}
      if (typeof name !== 'string' || name.trim().length < 2 || name.length > 100) return error(res, 400, 'Nombre inválido.')
      if (!['client','instructor'].includes(role)) return error(res, 400, 'Tipo de cuenta inválido.')
      if (!identity.email) return error(res, 400, 'Tu cuenta necesita un correo electrónico.')
      let user = store.users.find(u => u.id === identity.uid)
      if (!user) {
        user = { id: identity.uid, name: name.trim(), email: identity.email,
          role, preferences: { interests: [], budget: 100, district: 'Miraflores', day: '' }, favorites: [] }
        await persist('users', user)
        store.users.push(user)
      }
      res.json({ user: safeUser(user) })
    } catch (e) { return error(res, 401, 'Token Firebase inválido o error guardando el perfil.') }
  })
  app.get('/api/auth/me', auth, (req,res) => res.json({user:safeUser(req.user)}))
  app.patch('/api/me', auth, async (req,res,next) => {
    const { name, preferences } = req.body || {}
    const updated = { ...req.user }
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) return error(res,400,'Nombre inválido.')
      updated.name = name.trim()
    }
    if (preferences !== undefined) {
      if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) return error(res,400,'Preferencias inválidas.')
      const cur = req.user.preferences || {}
      const { interests=cur.interests??[], budget=cur.budget??100, district=cur.district??'Miraflores', day=cur.day??'' } = preferences
      if (!Array.isArray(interests) || !interests.every(c => categories.includes(c)) || !(typeof budget === 'number' || (typeof budget === 'string' && /^\d+(\.\d+)?$/.test(budget))) || !within(Number(budget),0,9999) || !isDistrict(district) || !['','sábado','domingo','lunes','martes','miércoles','jueves','viernes'].includes(day)) return error(res,400,'Revisa las preferencias ingresadas.')
      updated.preferences = { interests, budget:Number(budget), district, day }
    }
    await persist('users', updated)
    Object.assign(req.user, updated)
    res.json({ user:safeUser(req.user) })
  })

  // Todo el catálogo exige sesión iniciada: Hobbiz no ofrece navegación anónima.
  app.get('/api/workshops', auth, (req,res) => {
    const { q='', category='', district='', maxPrice='', day='', timeOfDay='', near='', lat='', lon='', radiusKm='15' } = req.query
    let list = store.workshops.filter(w => w.published && w.date >= todayLima()).map(w => enrich(store,w))
    // Agotados ocultos salvo cuando el usuario escribe el nombre exacto del taller (o del local).
    list = list.filter(w => w.available > 0 || (q && [w.title, w.venue].some(name => normalize(name) === normalize(q))))
    if (q) list = list.filter(w => normalize([w.title,w.venue,w.instructorName,w.summary,w.description,w.category,w.address,w.district].join(' ')).includes(normalize(q)))
    if (category && category !== 'Todos') list = list.filter(w => w.category === category)
    if (district) list = list.filter(w => w.district === district)
    if (maxPrice !== '') list = list.filter(w => w.price <= Number(maxPrice))
    if (day) list = list.filter(w => {
      const names=['domingo','lunes','martes','miércoles','jueves','viernes','sábado']
      return normalize(names[new Date(`${w.date}T12:00:00Z`).getUTCDay()]) === normalize(day)
    })
    // Rango horario exacto (rama de Santiago): "empieza desde" y "termina hasta".
    const { startsAfter='', endsBefore='' } = req.query
    const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/
    if (typeof startsAfter !== 'string' || typeof endsBefore !== 'string' || (startsAfter && !hhmm.test(startsAfter)) || (endsBefore && !hhmm.test(endsBefore))) return error(res,400,'Revisa las horas seleccionadas.')
    if (startsAfter && endsBefore && startsAfter >= endsBefore) return error(res,400,'La hora inicial debe ser anterior a la hora final.')
    if (startsAfter) list = list.filter(w => w.startsAt >= startsAfter)
    if (endsBefore) list = list.filter(w => w.endsAt <= endsBefore)
    if (timeOfDay) list = list.filter(w => normalize(timeSlot(w.startsAt)) === normalize(timeOfDay))
    if (lat !== '' || lon !== '') {
      const a=Number(lat), b=Number(lon),maxKm=Number(radiusKm)
      if(!within(a,-90,90)||!within(b,-180,180))return error(res,400,'Coordenadas GPS no válidas.')
      list=list.map(w=>({...w,distanceKm:round(distanceKm([a,b],[w.lat,w.lon]))})).filter(w=>w.distanceKm<=(within(maxKm,0.1,100)?maxKm:15)).sort((x,y)=>x.distanceKm-y.distanceKm)
    } else if (isDistrict(near)) {
      const maxKm = Number(radiusKm)
      list = list.map(w => ({ ...w, distanceKm:round(distanceKm(districts[near],[w.lat,w.lon])) })).filter(w => w.distanceKm <= (within(maxKm,0.1,100) ? maxKm : 15)).sort((a,b)=>a.distanceKm-b.distanceKm)
    }
    res.json({ items:list, count:list.length })
  })
  app.get('/api/recommendations', client, (req,res) => {
    const pref = req.user.preferences || { interests:['Arte'], district:'Miraflores', budget:80 }
    const list = store.workshops.filter(w => w.published && w.date >= todayLima() && w.enrollmentOpen !== false && w.capacity > seatsBooked(store,w.id)).map(w => {
      let score=0
      if (pref.interests?.includes(w.category)) score+=4
      if (w.price <= (pref.budget||100)) score+=2
      if (w.district === pref.district) score+=3
      else if (isDistrict(pref.district) && distanceKm([w.lat,w.lon],districts[pref.district]) < 3) score+=1
      return { ...enrich(store,w), matchScore:score }
    }).sort((a,b)=>b.matchScore-a.matchScore||a.price-b.price)
    res.json({ items:list.slice(0,4) })
  })
  app.get('/api/workshops/:id', auth, (req,res) => {
    const w = publicWorkshop(store,req.params.id)
    if (!w || !w.published) return error(res,404,'Taller no encontrado.')
    res.json({ item:w })
  })
  app.get('/api/workshops/:id/reviews', auth, (req,res) => {
    if (!publicWorkshop(store,req.params.id)?.published) return error(res,404,'Taller no encontrado.')
    res.json({ items:feedback(store,req.params.id).slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(r=>({...r,name:displayName(store,r)})) })
  })
  app.post('/api/workshops/:id/reviews', auth, async (req,res) => {
    if (req.user.role !== 'client') return error(res,403,'Solo los participantes pueden valorar.')
    if (!publicWorkshop(store,req.params.id)?.published) return error(res,404,'Taller no encontrado.')
    const { stars, comment } = req.body || {}
    if (typeof stars !== 'number' || !Number.isInteger(Number(stars)) || !within(Number(stars),1,5) || typeof comment!=='string' || comment.trim().length < 8 || comment.trim().length > 500) return error(res,400,'Escribe una reseña de 8 a 500 caracteres y selecciona de 1 a 5 estrellas.')
    if (!store.bookings.some(b => b.workshopId===req.params.id && b.userId===req.user.id && b.status==='confirmada')) return error(res,403,'Solo puedes valorar talleres en los que tienes una reserva.')
    const existing = store.reviews.find(r => r.workshopId===req.params.id && r.userId===req.user.id)
    if (existing) {
      const updated = { ...existing, stars:Number(stars), comment:comment.trim(), createdAt:new Date().toISOString() }
      await persist('reviews', updated)
      Object.assign(existing, updated)
      return res.json({item:existing})
    }
    const review = { id:randomUUID(), workshopId:req.params.id, userId:req.user.id, name:req.user.name, stars:Number(stars), comment:comment.trim(), createdAt:new Date().toISOString() }
    await persist('reviews', review)
    store.reviews.push(review)
    res.status(201).json({item:review})
  })

  app.get('/api/me/favorites', client, (req,res) => res.json({items:req.user.favorites.map(id => publicWorkshop(store,id)).filter(w => w?.published)}))
  app.post('/api/me/favorites/:id', client, async (req,res) => {
    if (!publicWorkshop(store,req.params.id)?.published) return error(res,404,'Taller no encontrado.')
    const favorites = [...new Set([...(req.user.favorites || []), req.params.id])]
    await persist('users', { ...req.user, favorites })
    req.user.favorites = favorites
    res.json({ favorites })
  })
  app.delete('/api/me/favorites/:id', client, async (req,res) => {
    const favorites = (req.user.favorites || []).filter(id => id !== req.params.id)
    await persist('users', { ...req.user, favorites })
    req.user.favorites = favorites
    res.json({ favorites })
  })
  app.get('/api/me/bookings', client, (req,res) => res.json({items:store.bookings.filter(b=>b.userId===req.user.id).map(b=>({...b,workshop:publicWorkshop(store,b.workshopId)})).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))}))
  app.post('/api/workshops/:id/bookings', auth, async (req,res) => {
    if (req.user.role !== 'client') return error(res,403,'Solo los clientes pueden reservar talleres.')
    const seats=Number(req.body?.seats ?? 1)
    if (!Number.isInteger(seats) || !within(seats,1,10)) return error(res,400,'Selecciona entre 1 y 10 cupos.')
    // La cola global de escrituras serializa las reservas: el conteo de cupos y el guardado no se intercalan.
    const w=store.workshops.find(w=>w.id===req.params.id && w.published)
    if (!w) return error(res,404,'Taller no encontrado.')
    if (w.enrollmentOpen === false) return error(res,409,'El tallerista cerró temporalmente las inscripciones de este taller.')
    if (w.date < todayLima()) return error(res,409,'Este taller ya se realizó; no admite nuevas reservas.')
    if (seats > w.capacity - seatsBooked(store,w.id)) return error(res,409,'No quedan suficientes cupos disponibles.')
    const booking={id:randomUUID(),workshopId:w.id,userId:req.user.id,seats,unitPrice:w.price,amount:seats*w.price,status:'confirmada',createdAt:new Date().toISOString()}
    await persist('bookings',booking)
    store.bookings.push(booking)
    return res.status(201).json({item:booking,workshop:enrich(store,w)})
  })

  app.get('/api/instructor/workshops', instructor, (req,res) => res.json({items:store.workshops.filter(w => w.instructorId===req.user.id).map(w => enrich(store,w))}))
  app.post('/api/instructor/workshops', instructor, async (req,res) => {
    const msg=validateWorkshop(req.body || {})
    if (msg) return error(res,400,msg)
    const p=req.body
    if (p.date < todayLima()) return error(res,400,'La fecha del taller no puede estar en el pasado.')
    const w={ id:randomUUID(), instructorId:req.user.id, published:true, currency:'PEN', ...Object.fromEntries(['title','summary','description','category','district','venue','address','date','startsAt','endsAt','level','materialsIncluded','materialsBring','image'].map(k=>[k,p[k].trim()])), price:Number(p.price), capacity:Number(p.capacity), lat:Number(p.lat), lon:Number(p.lon), enrollmentOpen:p.enrollmentOpen !== false }
    // Sesiones recurrentes semanales: instancias independientes con sus propios cupos.
    const count = p.recurrence === 'weekly' ? Number(p.repeatCount || 1) : 1
    if (!Number.isInteger(count) || count < 1 || count > 8) return error(res,400,'Máximo 8 sesiones semanales.')
    if (p.recurrence && !['once','weekly'].includes(p.recurrence)) return error(res,400,'Recurrencia inválida.')
    const seriesId = count > 1 ? randomUUID() : null
    const created=[]
    for (let i=0;i<count;i++) {
      const session={...w, id: i ? randomUUID() : w.id, recurrenceGroupId: seriesId, recurrence: count>1?'weekly':'once', repeatCount:count}
      if (i) { const day=new Date(`${w.date}T12:00:00Z`); day.setUTCDate(day.getUTCDate()+i*7); session.date=day.toISOString().slice(0,10) }
      created.push(session)
    }
    await persistAll('workshops', created)
    store.workshops.push(...created)
    res.status(201).json({item:enrich(store,created[0]),createdCount:created.length,sessions:created.map(x=>({id:x.id,date:x.date}))})
  })
  app.put('/api/instructor/workshops/:id', instructor, async (req,res) => {
    const w=store.workshops.find(w => w.id===req.params.id && w.instructorId===req.user.id)
    if (!w) return error(res,404,'No existe el taller o no te pertenece.')
    const payload={...w,...req.body}
    const msg=validateWorkshop(payload)
    if (msg) return error(res,400,msg)
    if (Number(payload.capacity) < seatsBooked(store,w.id)) return error(res,409,'No puedes reducir cupos por debajo de las reservas confirmadas.')
    if (payload.date !== w.date && payload.date < todayLima()) return error(res,400,'La fecha del taller no puede estar en el pasado.')
    const updated = { ...w, ...Object.fromEntries(['title','summary','description','category','district','venue','address','date','startsAt','endsAt','level','materialsIncluded','materialsBring','image'].map(k=>[k,payload[k].trim()])), price:Number(payload.price),capacity:Number(payload.capacity), lat:Number(payload.lat), lon:Number(payload.lon), published:payload.published !== false, enrollmentOpen:payload.enrollmentOpen !== false }
    await persist('workshops', updated)
    Object.assign(w, updated)
    res.json({item:enrich(store,w)})
  })
  app.delete('/api/instructor/workshops/:id', instructor, async (req,res) => {
    const idx=store.workshops.findIndex(w=>w.id===req.params.id && w.instructorId===req.user.id)
    if (idx<0) return error(res,404,'Taller no encontrado.')
    if (seatsBooked(store,req.params.id)) return error(res,409,'No se puede eliminar un taller con reservas; edítalo o despublícalo.')
    await removePersisted('workshops', req.params.id)
    store.workshops.splice(idx,1)
    res.status(204).end()
  })
  app.get('/api/instructor/bookings', instructor, (req,res) => {
    const owned=new Set(store.workshops.filter(w=>w.instructorId===req.user.id).map(w=>w.id))
    const {workshopId} = req.query
    const items=store.bookings.filter(b=>owned.has(b.workshopId) && (!workshopId || b.workshopId===workshopId)).map(b=>({ ...b, studentName:store.users.find(u=>u.id===b.userId)?.name || 'Participante de demostración',workshop:publicWorkshop(store,b.workshopId) }))
    res.json({items})
  })
  app.get('/api/instructor/schedule', instructor, (req,res) => res.json({items:store.workshops.filter(w=>w.instructorId===req.user.id).map(w=>enrich(store,w)).sort((a,b)=>`${a.date} ${a.startsAt}`.localeCompare(`${b.date} ${b.startsAt}`))}))
  app.get('/api/instructor/reviews', instructor, (req,res) => {
    const owned=new Set(store.workshops.filter(w=>w.instructorId===req.user.id).map(w=>w.id))
    res.json({items:store.reviews.filter(r=>owned.has(r.workshopId)).map(r=>({...r,workshopTitle:store.workshops.find(w=>w.id===r.workshopId)?.title || ''}))})
  })
  app.get('/api/instructor/dashboard', instructor, (req,res) => {
    const owned=store.workshops.filter(w=>w.instructorId===req.user.id).map(w=>enrich(store,w))
    const totalSeats=owned.reduce((s,w)=>s+w.capacity,0), reserved=owned.reduce((s,w)=>s+w.reserved,0)
    const rs=store.reviews.filter(r=>owned.some(w=>w.id===r.workshopId))
    res.json({ activeWorkshops:owned.filter(w=>w.published).length, seatsReserved:reserved, capacity:totalSeats, occupancy:totalSeats?Math.round((reserved/totalSeats)*100):0, estimatedGross:owned.reduce((s,w)=>s+w.estimatedGross,0), averageRating:rs.length?round(rs.reduce((s,r)=>s+r.stars,0)/rs.length):null, reviewCount:rs.length, byWorkshop:owned.map(w=>({id:w.id,title:w.title,date:w.date,reserved:w.reserved,capacity:w.capacity,occupancy:Math.round(w.reserved/w.capacity*100),estimatedGross:w.estimatedGross,enrollmentOpen:w.enrollmentOpen})) })
  })

  // Perfil público y personalización sencilla del tallerista (sin diseñador arbitrario de HTML).
  app.get('/api/instructors/:id', auth, (req,res) => {
    const user=store.users.find(u=>u.id===req.params.id && u.role==='instructor')
    if (!user) return error(res,404,'Tallerista no encontrado.')
    const workshops=store.workshops.filter(w=>w.instructorId===user.id && w.published).map(w=>enrich(store,w))
    const rated=workshops.filter(w=>w.rating!==null)
    const ids=new Set(workshops.map(w=>w.id))
    const reviews=store.reviews.filter(r=>ids.has(r.workshopId)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,10).map(r=>({...r,workshopTitle:workshops.find(w=>w.id===r.workshopId)?.title||''}))
    res.json({ item: {id:user.id, name:user.name, claimed:user.claimed!==false, studio:user.studio||{}, workshopCount:workshops.length, workshops, reviews,
      averageRating: rated.length ? round(rated.reduce((s,w)=>s+w.rating*w.reviewCount,0)/rated.reduce((s,w)=>s+w.reviewCount,0)) : null } })
  })
  // Personalización: el tallerista decide colores, tipografía, distribución, textos, portada y enlaces.
  // Se guardan solo valores validados (nunca HTML/CSS libre) para evitar inyección de código.
  app.patch('/api/instructor/studio', instructor, async (req,res) => {
    const {displayName='',tagline='',bio='',link='',accent='terracota',accentColor='',font='moderna',layout='portada',coverImage='',links={},gallery=[],district='',address=''}=req.body||{}
    const text=(v,max)=>typeof v==='string'&&v.length<=max
    if (!text(accentColor,7)||!text(district,40)||!text(coverImage,1_600_000)) return error(res,400,'Revisa los datos del perfil del tallerista.')
    if (!text(displayName,90)||!text(tagline,140)||!text(bio,900)||!text(link,220)||!text(address,160) || !accents.includes(accent) || !fonts.includes(font) || !layouts.includes(layout)) return error(res,400,'Revisa los datos del perfil del tallerista.')
    if (accentColor && !/^#[0-9a-f]{6}$/i.test(accentColor)) return error(res,400,'El color personalizado debe tener formato #RRGGBB.')
    if (district && !isDistrict(district)) return error(res,400,'Selecciona Miraflores o Barranco.')
    if (coverImage && !validImage(coverImage)) return error(res,400,'Selecciona una foto de portada válida.')
    if (!Array.isArray(gallery) || gallery.length>6 || !gallery.every(validImage)) return error(res,400,'La galería admite hasta 6 imágenes válidas.')
    const linkKeys=['web','instagram','facebook','tiktok','whatsapp']
    if (!links || typeof links!=='object' || Array.isArray(links) || Object.keys(links).some(k=>!linkKeys.includes(k))) return error(res,400,'Enlaces no válidos.')
    const cleanLinks={}
    for (const k of linkKeys) {
      const v=String(links[k]||'').trim()
      if (!v) continue
      if (v.length>220 || !HTTPS_URL.test(v)) return error(res,400,`El enlace de ${k} debe empezar con https://`)
      cleanLinks[k]=v
    }
    if (link && !HTTPS_URL.test(link)) return error(res,400,'Introduce un enlace HTTPS válido.')
    if (link && !cleanLinks.web) cleanLinks.web=link.trim()
    const studio={displayName:displayName.trim(),tagline:tagline.trim(),bio:bio.trim(),link:cleanLinks.web||'',links:cleanLinks,accent,accentColor:accentColor.toLowerCase(),font,layout,coverImage,gallery,district,address:address.trim()}
    await persist('users',{ ...req.user, studio })
    req.user.studio=studio
    res.json({item:req.user.studio})
  })
  app.post('/api/feedback', auth, async (req,res) => {
    const {rating,comment,area='general',understanding=null,newFeatures=null,recommendation=''}=req.body||{}
    const scale=v=>v===null||(Number.isInteger(Number(v))&&Number(v)>=1&&Number(v)<=5)
    if (!Number.isInteger(Number(rating)) || Number(rating)<1 || Number(rating)>5 || typeof comment!=='string' || comment.trim().length<10 || comment.length>1000 || !['general','busqueda','reserva','tallerista','mapa'].includes(area)) return error(res,400,'Califica de 1 a 5 y deja un comentario de 10 a 1000 caracteres.')
    if (!scale(understanding) || !scale(newFeatures) || typeof recommendation!=='string' || recommendation.length>1000) return error(res,400,'Revisa las respuestas del formulario.')
    const item={id:randomUUID(),userId:req.user.id,role:req.user.role,area,rating:Number(rating),understanding:understanding===null?null:Number(understanding),newFeatures:newFeatures===null?null:Number(newFeatures),comment:comment.trim(),recommendation:recommendation.trim(),createdAt:new Date().toISOString()}
    store.feedback ||= []
    await persist('feedback',item)
    store.feedback.push(item)
    res.status(201).json({item:{id:item.id,createdAt:item.createdAt}})
  })
  app.use('/api', (_req,res) => error(res,404,'Ruta de API no encontrada.'))
  app.use((err,req,res,next) => {
    if (err instanceof SyntaxError && err.status===400) return error(res,400,'El JSON enviado no es válido.')
    if (err?.type==='entity.too.large') return error(res,413,'La imagen es demasiado grande.')
    console.error(err)
    error(res,500,'Ocurrió un error inesperado en el servidor.')
  })
  return app
}

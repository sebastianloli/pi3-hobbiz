import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { randomUUID, randomBytes, timingSafeEqual, scrypt as scryptCallback, createHash } from 'node:crypto'
import { promisify } from 'node:util'
import { categories, createSeedStore, districts, districtBounds, districtAreas, insideArea, isDistrict, imageNames, accents, fonts, layouts } from './data.js'

const scrypt = promisify(scryptCallback)
const safeUser = ({ passwordHash, ...user }) => user
// Sin tildes ni mayúsculas: "ceramica" encuentra "Cerámica".
const normalize = (s) => String(s ?? '').trim().toLocaleLowerCase('es-PE').normalize('NFD').replace(/\p{Diacritic}/gu, '')
const round = (n) => Math.round(n * 10) / 10
const within = (n, min, max) => Number.isFinite(n) && n >= min && n <= max
const average = (stars) => stars.length ? round(stars.reduce((s, v) => s + v, 0) / stars.length) : null
// Fecha y hora actuales en Lima (UTC-5, sin horario de verano), como "AAAA-MM-DDTHH:MM".
const nowLima = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 16)
const todayLima = () => nowLima().slice(0, 10)
const hasStarted = (w) => `${w.date}T${w.startsAt}` <= nowLima()
const hasEnded = (w) => `${w.date}T${w.endsAt}` <= nowLima()
const bookingAmount = (b, w) => Number.isFinite(b.amount) ? b.amount : b.seats * (w?.price || 0)
const confirmed = (store, id) => store.bookings.filter(b => b.workshopId === id && b.status === 'confirmada')
const seatsBooked = (store, id) => confirmed(store, id).reduce((sum, b) => sum + b.seats, 0)
// Máximo de cupos que una misma persona puede reservar en una sesión (evita que alguien acapare el aforo).
export const MAX_SEATS_PER_USER = 5
// Nombre público de quien reseña: nombre + inicial del apellido, siempre con el nombre actual del perfil.
const displayName = (store, r) => { const u = store.users.find(x => x.id === r.userId); const full = (u?.name || r.name || 'Participante').trim(); const [first, last] = full.split(/\s+/); return last ? `${first} ${last[0]}.` : first }
const reviewsOf = (store, id) => store.reviews.filter(r => r.workshopId === id)
const publicReview = (store, r, viewer) => ({ id: r.id, workshopId: r.workshopId, name: displayName(store, r), stars: r.stars, comment: r.comment, createdAt: r.createdAt, updatedAt: r.updatedAt || null, mine: r.userId === viewer?.id })
const distanceKm = (a,b) => {
  const radians = v => (v*Math.PI)/180
  const dlat = radians(b[0]-a[0]), dlon=radians(b[1]-a[1])
  const x = Math.sin(dlat/2)**2 + Math.cos(radians(a[0]))*Math.cos(radians(b[0]))*Math.sin(dlon/2)**2
  return 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))
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
const timeSlot = (hhmm) => hhmm < '12:00' ? 'mañana' : hhmm < '18:00' ? 'tarde' : 'noche'
const HTTPS_URL = /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(?:[\/?#][^\s<>"']*)?$/i
const numeric = (v) => (typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v.trim()))

// Contraseñas (modo demo): scrypt asíncrono para no bloquear el servidor en cada intento de inicio de sesión.
async function hashPasswordAsync(password) {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${(await scrypt(password, salt, 64)).toString('hex')}`
}
async function checkPassword(password, digest) {
  const [salt, expected] = String(digest).split(':')
  if (!salt || !expected) return false
  const actual = await scrypt(String(password), salt, 64)
  const exp = Buffer.from(expected, 'hex')
  return actual.length === exp.length && timingSafeEqual(actual, exp)
}

// ---- Imágenes ----
// Las fotos subidas se guardan como data URI, pero las respuestas JSON solo llevan una URL a /api/images/...
// (el catálogo ya no viaja con megabytes de base64). Si esa URL vuelve en un guardado, se resuelve a la original.
const MAX_DATA_URI = 1_100_000
const isDataUri = (s) => typeof s === 'string' && s.startsWith('data:image/')
const IMAGE_REF = /\/api\/images\/(w|cover|gallery)\/([^/?#]+)(?:\/(\d+))?/
function validImage(source) {
  if (typeof source !== 'string') return false
  if (/^\/images\/[a-z0-9-]+\.(jpg|svg)$/i.test(source)) return imageNames.includes(source.split('/').at(-1))
  if (HTTPS_URL.test(source)) return source.length <= 500
  return /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(source) && source.length < MAX_DATA_URI
}
function storedImage(store, kind, id, index) {
  if (kind === 'w') return store.workshops.find(w => w.id === id)?.image
  const user = store.users.find(u => u.id === id)
  return kind === 'cover' ? user?.studio?.coverImage : user?.studio?.gallery?.[Number(index)]
}
const resolveImage = (store, src) => {
  const m = typeof src === 'string' && src.match(IMAGE_REF)
  return m ? storedImage(store, m[1], decodeURIComponent(m[2]), m[3]) ?? src : src
}

// Compatibilidad con la rama de Santiago, que enviaba latitude/longitude en vez de lat/lon.
function coords(p) {
  if (p.lat === undefined && p.latitude !== undefined) p.lat = p.latitude
  if (p.lon === undefined && p.longitude !== undefined) p.lon = p.longitude
  delete p.latitude; delete p.longitude
  return p
}
const WORKSHOP_TEXT = ['title','summary','description','category','district','venue','address','date','startsAt','endsAt','level','materialsIncluded','materialsBring','image']
function validateWorkshop(p) {
  coords(p)
  for (const field of WORKSHOP_TEXT) if (typeof p[field] !== 'string' || !p[field].trim()) return `Completa el campo obligatorio: ${field}.`
  if (!categories.includes(p.category)) return 'La categoría no es válida.'
  if (!isDistrict(p.district)) return 'Selecciona Miraflores o Barranco.'
  if (!numeric(p.price) || !within(Number(p.price), 0, 9999)) return 'El precio debe ser un número entre 0 y 9999.'
  if (!numeric(p.capacity) || !Number.isInteger(Number(p.capacity)) || !within(Number(p.capacity), 1, 1000)) return 'Los cupos deben ser un entero entre 1 y 1000.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date) || Number.isNaN(Date.parse(p.date)) || new Date(`${p.date}T12:00:00Z`).toISOString().slice(0,10) !== p.date) return 'La fecha no es válida.'
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.startsAt) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.endsAt) || p.startsAt >= p.endsAt) return 'Indica un horario válido.'
  if (!validImage(p.image)) return 'Selecciona una foto válida (galería, enlace HTTPS o JPG/PNG/WebP de hasta 800 KB).'
  if (!within(Number(p.lat), -90, 90) || !within(Number(p.lon), -180, 180)) return 'Marca la ubicación del taller en el mapa.'
  if (!insideArea(p.district, Number(p.lat), Number(p.lon))) return `El punto del mapa debe estar dentro de ${p.district}.`
  return null
}

export function createApp(store = createSeedStore(), options = {}) {
  const mode = options.mode || 'demo'
  const persistent = mode === 'firebase-mongo'
  // Correos de administración (ADMIN_EMAILS): aprueban talleristas y leen el formulario de opinión.
  const admins = new Set((options.adminEmails ?? (persistent ? [] : ['admin@hobbiz.pe'])).map(e => String(e).trim().toLowerCase()).filter(Boolean))
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
  // Detrás del proxy de Render/Railway: necesario para la IP real (límites) y para armar URLs https.
  if (options.trustProxy) app.set('trust proxy', options.trustProxy)
  // Las imágenes de /api/images se muestran desde el dominio del frontend: se permiten entre orígenes.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
  // CORS: lista de orígenes separada por comas (producción + vistas previas). En demo local se permite cualquiera.
  const origins = options.corsOrigins ?? String(process.env.CORS_ORIGIN || (persistent ? 'http://localhost:5173' : '')).split(',').map(s => s.trim()).filter(Boolean)
  app.use(cors({ origin: origins.length ? origins : true }))
  app.use(express.json({ limit: '2mb' }))

  // Límites de peticiones por IP (activados por index.js; los tests los activan solo donde los prueban).
  const limit = (max, windowMinutes, extra = {}) => options.rateLimit
    ? rateLimit({ windowMs: windowMinutes * 60_000, limit: max, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Demasiados intentos. Espera unos minutos y vuelve a probar.' }, ...extra })
    : (_req, _res, next) => next()
  app.use('/api', limit(600, 15))
  const loginLimit = limit(10, 15, { skipSuccessfulRequests: true })
  const signupLimit = limit(10, 60)
  const writeLimit = limit(60, 1)

  // Cola de escrituras: las peticiones que modifican datos se atienden de una en una (después de autenticar,
  // para no retener a nadie mientras se verifica un token). Así dos reservas no venden el mismo cupo. UNA instancia.
  let mutationTail = Promise.resolve()
  const serial = (req, res, next) => {
    const previous = mutationTail
    let release
    mutationTail = new Promise(resolve => { release = resolve })
    let done = false
    const finish = () => { if (!done) { done = true; release() } }
    res.once('finish', finish); res.once('close', finish)
    previous.then(() => next(), next)
  }

  // Identidad: en Firebase el token verificado trae uid y email_verified; en demo, la sesión en memoria.
  const requireAuth = (role) => async (req, res, next) => {
    try {
      const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
      if (persistent) {
        if (!token) return error(res, 401, 'Inicia sesión para continuar.')
        const identity = await options.verifyIdToken(token)
        req.identity = identity
        req.user = store.users.find(u => u.id === identity.uid) || null
        req.emailVerified = identity.email_verified === true
        if (req.user && req.user.emailVerified !== req.emailVerified) {
          await persist('users', { ...req.user, emailVerified: req.emailVerified })
          req.user.emailVerified = req.emailVerified
        }
      } else {
        const session = store.sessions.get(token)
        if (session && session.expiresAt < Date.now()) store.sessions.delete(token)
        const live = session && session.expiresAt >= Date.now()
        req.user = live ? store.users.find(u => u.id === session.userId) || null : null
        req.emailVerified = req.user?.emailVerified !== false
      }
      if (!req.user) return error(res,401,'Completa tu perfil o inicia sesión.')
      if (req.user.archived) return error(res,403,'Esta cuenta no está activa.')
      if (role === 'admin' && !isAdmin(req)) return error(res,403,'Solo el equipo de Hobbiz puede hacer esto.')
      if (role && role !== 'admin' && req.user.role !== role) return error(res,403,'No tienes permisos para realizar esta acción.')
      next()
    } catch { return error(res,401,'La sesión no es válida. Vuelve a ingresar.') }
  }
  const isAdmin = (req) => admins.has(String(req.user?.email || '').toLowerCase()) && req.emailVerified
  const auth = requireAuth()
  const instructor = requireAuth('instructor')
  const client = requireAuth('client')
  const admin = requireAuth('admin')
  const verified = (action) => (req, res, next) => req.emailVerified ? next() : error(res, 403, `Verifica tu correo electrónico para ${action}.`)
  const approved = (req, res, next) => req.user.instructorStatus === 'approved' ? next() : error(res, 403, 'Tu cuenta de tallerista está en revisión: podrás publicar talleres cuando el equipo de Hobbiz la apruebe.')
  // Sesiones demo vencidas: limpieza periódica para que la memoria no crezca sin límite.
  if (!persistent) setInterval(() => { const now = Date.now(); for (const [t, s] of store.sessions) if (s.expiresAt < now) store.sessions.delete(t) }, 10 * 60_000).unref()

  // ---- Presentación de datos (lo que sale en JSON) ----
  const baseUrl = (req) => options.publicUrl || `${req.protocol}://${req.get('host')}`
  const imageUrl = (req, src, kind, id, index) => isDataUri(src)
    ? `${baseUrl(req)}/api/images/${kind}/${encodeURIComponent(id)}${index !== undefined ? `/${index}` : ''}?v=${createHash('sha1').update(src).digest('hex').slice(0, 10)}`
    : src
  const studioOut = (req, user) => {
    const s = user?.studio
    if (!s) return null
    return { ...s, coverImage: imageUrl(req, s.coverImage, 'cover', user.id), gallery: (s.gallery || []).map((g, i) => imageUrl(req, g, 'gallery', user.id, i)) }
  }
  const meOut = (req) => ({ ...safeUser(req.user), studio: studioOut(req, req.user), emailVerified: req.emailVerified, isAdmin: isAdmin(req) })
  // Taller para responder: `owner` agrega el monto recaudado (solo para su tallerista).
  const enrich = (req, workshop, { owner = false } = {}) => {
    const reviews = reviewsOf(store, workshop.id)
    const taken = seatsBooked(store, workshop.id)
    const ownerUser = store.users.find(u => u.id === workshop.instructorId)
    const s = ownerUser?.studio
    const out = { ...workshop, image: imageUrl(req, workshop.image, 'w', workshop.id), enrollmentOpen: workshop.enrollmentOpen !== false,
      started: hasStarted(workshop), past: hasEnded(workshop), reserved: taken, available: Math.max(0, workshop.capacity - taken),
      rating: average(reviews.map(r => r.stars)), reviewCount: reviews.length,
      instructorName: s?.displayName || ownerUser?.name || 'Tallerista de Hobbiz',
      // Solo lo que la ficha muestra del tallerista (sin galería ni datos privados).
      instructorStudio: s ? { displayName: s.displayName, bio: s.bio, accent: s.accent, accentColor: s.accentColor, links: s.links || {}, coverImage: imageUrl(req, s.coverImage, 'cover', ownerUser.id) } : null,
      instructorClaimed: ownerUser?.claimed !== false }
    if (owner) out.estimatedGross = confirmed(store, workshop.id).reduce((sum, b) => sum + bookingAmount(b, workshop), 0)
    return out
  }
  // ¿Puede esta persona ver el taller? Publicado: todos. Oculto: su tallerista y quien lo reservó.
  const canSee = (req, w) => w && (w.published || w.instructorId === req.user.id || store.bookings.some(b => b.workshopId === w.id && b.userId === req.user.id))
  const instructorVisible = (u, viewer) => u?.role === 'instructor' && !u.archived && (u.claimed === false || u.instructorStatus === 'approved' || u.id === viewer?.id)

  app.get('/api/health', (_req,res) => res.json({ status: 'ok', mode, version:'3.0.0' }))
  app.get('/api/meta', (_req,res) => res.json({ categories, districts: Object.keys(districts), districtCenters: districts, districtBounds, districtAreas, images: imageNames.map(i => `/images/${i}`), accents, fonts, layouts, maxSeatsPerUser: MAX_SEATS_PER_USER }))
  // Fotos subidas (data URI en la BD) servidas como imagen con caché larga; la URL lleva un hash de versión.
  app.get('/api/images/:kind/:id{/:index}', (req, res) => {
    if (!['w','cover','gallery'].includes(req.params.kind)) return error(res, 404, 'Imagen no encontrada.')
    const src = storedImage(store, req.params.kind, req.params.id, req.params.index)
    const m = isDataUri(src) && src.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/)
    if (!m) return error(res, 404, 'Imagen no encontrada.')
    res.set({ 'Content-Type': m[1], 'Cache-Control': 'public, max-age=31536000, immutable' }).send(Buffer.from(m[2], 'base64'))
  })

  app.post('/api/auth/login', loginLimit, async (req,res) => {
    if (persistent) return error(res, 409, 'Usa Firebase Authentication para acceder.')
    const { email='', password='', remember=false } = req.body || {}
    if (typeof email !== 'string' || typeof password !== 'string') return error(res,400,'Ingresa tu correo y contraseña.')
    const user = store.users.find(u => u.email && normalize(u.email) === normalize(email))
    if (!user || !user.passwordHash || !(await checkPassword(password, user.passwordHash))) return error(res,401,'Credenciales incorrectas.')
    res.json({ ...openSession(store, user.id, remember === true), user: { ...safeUser(user), studio: studioOut(req, user), emailVerified: user.emailVerified !== false, isAdmin: admins.has(user.email.toLowerCase()) } })
  })
  app.post('/api/auth/register', signupLimit, async (req,res) => {
    if (persistent) return error(res, 409, 'Usa Firebase Authentication para registrarte.')
    const { name='', email='', password='', role='client', remember=false } = req.body || {}
    if ([name,email,password].some(v => typeof v !== 'string') || name.trim().length > 100 || !password.trim()) return error(res,400,'Revisa nombre, correo y contraseña.')
    if (name.trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return error(res,400,'Ingresa nombre y correo válido.')
    if (password.length < 8) return error(res,400,'La contraseña debe tener al menos 8 caracteres.')
    if (!['client','instructor'].includes(role)) return error(res,400,'Tipo de cuenta inválido.')
    if (store.users.some(u => u.email && normalize(u.email) === normalize(email))) return error(res,409,'El correo ya está registrado.')
    // Modo demo: no se envían correos, así que el correo se da por verificado. La aprobación del tallerista sí aplica.
    const user = { id:randomUUID(), name:name.trim(), email:email.trim().toLowerCase(), passwordHash: await hashPasswordAsync(password), role, emailVerified:true, createdAt:new Date().toISOString(),
      ...(role === 'instructor' ? { instructorStatus:'pending' } : {}), preferences:{ interests:[], budget:100, district:'Miraflores', day:'' }, favorites:[] }
    store.users.push(user)
    res.status(201).json({ ...openSession(store, user.id, remember === true), user: { ...safeUser(user), emailVerified: true, isAdmin: admins.has(user.email) } })
  })
  app.post('/api/auth/logout', auth, (req,res) => { if (!persistent) store.sessions.delete(req.headers.authorization.replace(/^Bearer\s+/i,'')); res.status(204).end() })
  // Identidad única: un token Firebase verificado representa al mismo usuario en TODOS los endpoints.
  app.post('/api/account', signupLimit, async (req, res) => {
    if (!persistent) return error(res, 409, 'Disponible al configurar Firebase + MongoDB.')
    let identity
    try {
      const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
      if (!bearer) return error(res, 401, 'Se requiere un token Firebase.')
      identity = await options.verifyIdToken(bearer)
    } catch { return error(res, 401, 'Token Firebase inválido. Vuelve a iniciar sesión.') }
    const { name, role } = req.body || {}
    if (typeof name !== 'string' || name.trim().length < 2 || name.length > 100) return error(res, 400, 'Nombre inválido.')
    if (!['client','instructor'].includes(role)) return error(res, 400, 'Tipo de cuenta inválido.')
    if (!identity.email) return error(res, 400, 'Tu cuenta necesita un correo electrónico.')
    const email = identity.email.toLowerCase()
    req.emailVerified = identity.email_verified === true
    let user = store.users.find(u => u.id === identity.uid)
    // El correo ya tenía perfil con otro rol: se avisa en vez de entrar con un rol distinto al elegido.
    if (user && user.role !== role) return error(res, 409, `Este correo ya tiene una cuenta de ${user.role === 'instructor' ? 'tallerista' : 'cliente'}. Inicia sesión con ella.`)
    if (!user) {
      if (store.users.some(u => u.email && u.email.toLowerCase() === email)) return error(res, 409, 'Ya existe un perfil de Hobbiz con este correo. Escríbenos para recuperarlo.')
      user = { id: identity.uid, name: name.trim(), email, role, emailVerified: req.emailVerified, createdAt: new Date().toISOString(),
        ...(role === 'instructor' ? { instructorStatus: 'pending' } : {}), preferences: { interests: [], budget: 100, district: 'Miraflores', day: '' }, favorites: [] }
      try { await persist('users', user) }
      catch (e) { return e?.code === 11000 ? error(res, 409, 'Ya existe un perfil de Hobbiz con este correo.') : error(res, 500, 'No se pudo guardar tu perfil. Inténtalo de nuevo.') }
      store.users.push(user)
    }
    req.user = user
    res.json({ user: meOut(req) })
  })
  app.get('/api/auth/me', auth, (req,res) => res.json({ user: meOut(req) }))
  app.patch('/api/me', auth, writeLimit, serial, async (req,res) => {
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
      if (!Array.isArray(interests) || !interests.every(c => categories.includes(c)) || !numeric(budget) || !within(Number(budget),0,9999) || !isDistrict(district) || !['','sábado','domingo','lunes','martes','miércoles','jueves','viernes'].includes(day)) return error(res,400,'Revisa las preferencias ingresadas.')
      updated.preferences = { interests, budget:Number(budget), district, day }
    }
    await persist('users', updated)
    Object.assign(req.user, updated)
    res.json({ user: meOut(req) })
  })

  // Todo el catálogo exige sesión iniciada: Hobbiz no ofrece navegación anónima.
  app.get('/api/workshops', auth, (req,res) => {
    const { q='', category='', district='', maxPrice='', day='', timeOfDay='', near='', lat='', lon='', radiusKm='15', startsAfter='', endsBefore='' } = req.query
    // Solo sesiones que aún no empezaron.
    let list = store.workshops.filter(w => w.published && !hasStarted(w)).map(w => enrich(req, w))
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
    const list = store.workshops.filter(w => w.published && !hasStarted(w) && w.enrollmentOpen !== false && w.capacity > seatsBooked(store,w.id)).map(w => {
      let score=0
      if (pref.interests?.includes(w.category)) score+=4
      if (w.price <= (pref.budget ?? 100)) score+=2
      if (w.district === pref.district) score+=3
      else if (isDistrict(pref.district) && distanceKm([w.lat,w.lon],districts[pref.district]) < 3) score+=1
      return { ...enrich(req, w), matchScore:score }
    }).sort((a,b)=>b.matchScore-a.matchScore||a.price-b.price)
    res.json({ items:list.slice(0,4) })
  })
  app.get('/api/workshops/:id', auth, (req,res) => {
    const w = store.workshops.find(x => x.id === req.params.id)
    if (!canSee(req, w)) return error(res,404,'Taller no encontrado.')
    const mine = store.bookings.filter(b => b.workshopId === w.id && b.userId === req.user.id && b.status === 'confirmada').reduce((s, b) => s + b.seats, 0)
    res.json({ item: { ...enrich(req, w, { owner: w.instructorId === req.user.id }), mySeats: mine } })
  })
  app.get('/api/workshops/:id/reviews', auth, (req,res) => {
    const w = store.workshops.find(x => x.id === req.params.id)
    if (!canSee(req, w)) return error(res,404,'Taller no encontrado.')
    res.json({ items: reviewsOf(store, w.id).slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(r => publicReview(store, r, req.user)) })
  })
  app.post('/api/workshops/:id/reviews', client, verified('dejar una reseña'), writeLimit, serial, async (req,res) => {
    const w = store.workshops.find(x => x.id === req.params.id)
    if (!canSee(req, w)) return error(res,404,'Taller no encontrado.')
    const { stars, comment } = req.body || {}
    if (typeof stars !== 'number' || !Number.isInteger(stars) || !within(stars,1,5) || typeof comment!=='string' || comment.trim().length < 8 || comment.trim().length > 500) return error(res,400,'Escribe una reseña de 8 a 500 caracteres y selecciona de 1 a 5 estrellas.')
    if (!store.bookings.some(b => b.workshopId===w.id && b.userId===req.user.id && b.status==='confirmada')) return error(res,403,'Solo puedes valorar talleres en los que tienes una reserva.')
    if (!hasEnded(w)) return error(res,409,'Podrás dejar tu reseña cuando el taller haya terminado.')
    const existing = store.reviews.find(r => r.workshopId===w.id && r.userId===req.user.id)
    if (existing) {
      const updated = { ...existing, stars, comment:comment.trim(), updatedAt:new Date().toISOString() }
      await persist('reviews', updated)
      Object.assign(existing, updated)
      return res.json({ item: publicReview(store, existing, req.user) })
    }
    const review = { id:randomUUID(), workshopId:w.id, userId:req.user.id, stars, comment:comment.trim(), createdAt:new Date().toISOString() }
    await persist('reviews', review)
    store.reviews.push(review)
    res.status(201).json({ item: publicReview(store, review, req.user) })
  })

  app.get('/api/me/favorites', client, (req,res) => res.json({items:req.user.favorites.map(id => store.workshops.find(w => w.id === id)).filter(w => w?.published).map(w => enrich(req, w))}))
  app.post('/api/me/favorites/:id', client, writeLimit, serial, async (req,res) => {
    if (!store.workshops.find(w => w.id === req.params.id)?.published) return error(res,404,'Taller no encontrado.')
    const favorites = [...new Set([...(req.user.favorites || []), req.params.id])]
    await persist('users', { ...req.user, favorites })
    req.user.favorites = favorites
    res.json({ favorites })
  })
  app.delete('/api/me/favorites/:id', client, writeLimit, serial, async (req,res) => {
    const favorites = (req.user.favorites || []).filter(id => id !== req.params.id)
    await persist('users', { ...req.user, favorites })
    req.user.favorites = favorites
    res.json({ favorites })
  })
  app.get('/api/me/bookings', client, (req,res) => res.json({items:store.bookings.filter(b=>b.userId===req.user.id).map(b=>{ const w=store.workshops.find(x=>x.id===b.workshopId); return {...b, workshop: w ? enrich(req, w) : null, cancellable: b.status==='confirmada' && !!w && !hasStarted(w)} }).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))}))
  app.post('/api/workshops/:id/bookings', client, verified('reservar'), writeLimit, serial, async (req,res) => {
    const seats=req.body?.seats ?? 1
    if (typeof seats !== 'number' || !Number.isInteger(seats) || !within(seats,1,MAX_SEATS_PER_USER)) return error(res,400,`Selecciona entre 1 y ${MAX_SEATS_PER_USER} cupos.`)
    // La cola de escrituras serializa las reservas: el conteo de cupos y el guardado no se intercalan.
    const w=store.workshops.find(w=>w.id===req.params.id && w.published)
    if (!w) return error(res,404,'Taller no encontrado.')
    if (w.enrollmentOpen === false) return error(res,409,'El tallerista cerró temporalmente las inscripciones de este taller.')
    if (hasStarted(w)) return error(res,409,'Este taller ya empezó o terminó; no admite nuevas reservas.')
    const mine = store.bookings.filter(b => b.workshopId===w.id && b.userId===req.user.id && b.status==='confirmada').reduce((s,b)=>s+b.seats,0)
    if (mine + seats > MAX_SEATS_PER_USER) return error(res,409,`Puedes reservar como máximo ${MAX_SEATS_PER_USER} cupos por sesión (ya tienes ${mine}).`)
    if (seats > w.capacity - seatsBooked(store,w.id)) return error(res,409,'No quedan suficientes cupos disponibles.')
    const booking={id:randomUUID(),workshopId:w.id,userId:req.user.id,seats,unitPrice:w.price,amount:seats*w.price,status:'confirmada',createdAt:new Date().toISOString()}
    await persist('bookings',booking)
    store.bookings.push(booking)
    return res.status(201).json({item:booking,workshop:{ ...enrich(req, w), mySeats: mine + seats }})
  })
  // Cancelar una reserva propia antes de que empiece el taller: libera los cupos.
  app.post('/api/me/bookings/:id/cancel', client, writeLimit, serial, async (req,res) => {
    const b = store.bookings.find(x => x.id === req.params.id && x.userId === req.user.id)
    if (!b) return error(res,404,'Reserva no encontrada.')
    if (b.status !== 'confirmada') return error(res,409,'Esta reserva ya fue cancelada.')
    const w = store.workshops.find(x => x.id === b.workshopId)
    if (w && hasStarted(w)) return error(res,409,'El taller ya empezó; no se puede cancelar la reserva.')
    const updated = { ...b, status:'cancelada', cancelledAt:new Date().toISOString() }
    await persist('bookings', updated)
    Object.assign(b, updated)
    res.json({ item: b, workshop: w ? enrich(req, w) : null })
  })

  const ownWorkshop = (req) => store.workshops.find(w => w.id===req.params.id && w.instructorId===req.user.id)
  app.get('/api/instructor/workshops', instructor, (req,res) => res.json({items:store.workshops.filter(w => w.instructorId===req.user.id).map(w => enrich(req, w, { owner: true }))}))
  app.post('/api/instructor/workshops', instructor, approved, writeLimit, serial, async (req,res) => {
    const p={ ...(req.body || {}) }
    p.image = resolveImage(store, p.image)
    const msg=validateWorkshop(p)
    if (msg) return error(res,400,msg)
    if (`${p.date}T${p.startsAt}` <= nowLima()) return error(res,400,'La fecha y hora del taller deben ser futuras.')
    if (p.recurrence !== undefined && !['once','weekly'].includes(p.recurrence)) return error(res,400,'Recurrencia inválida.')
    // Sesiones recurrentes semanales: instancias independientes con sus propios cupos (2 a 8).
    const count = p.recurrence === 'weekly' ? Number(p.repeatCount) : 1
    if (p.recurrence === 'weekly' && (!numeric(p.repeatCount) || !Number.isInteger(count) || count < 2 || count > 8)) return error(res,400,'Una serie semanal tiene entre 2 y 8 sesiones.')
    const w={ id:randomUUID(), instructorId:req.user.id, published:true, currency:'PEN', ...Object.fromEntries(WORKSHOP_TEXT.map(k=>[k,p[k].trim()])), price:Number(p.price), capacity:Number(p.capacity), lat:Number(p.lat), lon:Number(p.lon), locationPrecision:'exacta', enrollmentOpen:p.enrollmentOpen !== false, createdAt:new Date().toISOString() }
    const seriesId = count > 1 ? randomUUID() : null
    const created=[]
    for (let i=0;i<count;i++) {
      const session={...w, id: i ? randomUUID() : w.id, recurrenceGroupId: seriesId, recurrence: count>1?'weekly':'once', repeatCount:count}
      if (i) { const day=new Date(`${w.date}T12:00:00Z`); day.setUTCDate(day.getUTCDate()+i*7); session.date=day.toISOString().slice(0,10) }
      created.push(session)
    }
    await persistAll('workshops', created)
    store.workshops.push(...created)
    res.status(201).json({item:enrich(req, created[0], { owner: true }),createdCount:created.length,sessions:created.map(x=>({id:x.id,date:x.date}))})
  })
  app.put('/api/instructor/workshops/:id', instructor, approved, writeLimit, serial, async (req,res) => {
    const w=ownWorkshop(req)
    if (!w) return error(res,404,'No existe el taller o no te pertenece.')
    const payload={...w,...(req.body || {})}
    payload.image = resolveImage(store, payload.image)
    const msg=validateWorkshop(payload)
    if (msg) return error(res,400,msg)
    if (Number(payload.capacity) < seatsBooked(store,w.id)) return error(res,409,'No puedes reducir cupos por debajo de las reservas confirmadas.')
    if ((payload.date !== w.date || payload.startsAt !== w.startsAt) && `${payload.date}T${payload.startsAt}` <= nowLima()) return error(res,400,'La nueva fecha y hora deben ser futuras.')
    const moved = Number(payload.lat) !== w.lat || Number(payload.lon) !== w.lon
    const updated = { ...w, ...Object.fromEntries(WORKSHOP_TEXT.map(k=>[k,payload[k].trim()])), price:Number(payload.price),capacity:Number(payload.capacity), lat:Number(payload.lat), lon:Number(payload.lon), published:payload.published !== false, enrollmentOpen:payload.enrollmentOpen !== false,
      ...(moved ? { locationPrecision:'exacta' } : {}), updatedAt:new Date().toISOString() }
    await persist('workshops', updated)
    Object.assign(w, updated)
    res.json({item:enrich(req, w, { owner: true })})
  })
  app.delete('/api/instructor/workshops/:id', instructor, writeLimit, serial, async (req,res) => {
    const w=ownWorkshop(req)
    if (!w) return error(res,404,'Taller no encontrado.')
    if (seatsBooked(store,w.id)) return error(res,409,'No se puede eliminar un taller con reservas; edítalo o despublícalo.')
    await removePersisted('workshops', w.id)
    store.workshops.splice(store.workshops.indexOf(w),1)
    res.status(204).end()
  })
  app.get('/api/instructor/bookings', instructor, (req,res) => {
    const owned=new Set(store.workshops.filter(w=>w.instructorId===req.user.id).map(w=>w.id))
    const {workshopId} = req.query
    const items=store.bookings.filter(b=>owned.has(b.workshopId) && (!workshopId || b.workshopId===workshopId)).map(b=>({ ...b, studentName:store.users.find(u=>u.id===b.userId)?.name || 'Participante de demostración',workshop:enrich(req, store.workshops.find(w=>w.id===b.workshopId), { owner: true }) }))
    res.json({items})
  })
  app.get('/api/instructor/schedule', instructor, (req,res) => res.json({items:store.workshops.filter(w=>w.instructorId===req.user.id).map(w=>enrich(req, w, { owner: true })).sort((a,b)=>`${a.date} ${a.startsAt}`.localeCompare(`${b.date} ${b.startsAt}`))}))
  app.get('/api/instructor/reviews', instructor, (req,res) => {
    const owned=new Set(store.workshops.filter(w=>w.instructorId===req.user.id).map(w=>w.id))
    res.json({items:store.reviews.filter(r=>owned.has(r.workshopId)).map(r=>({...publicReview(store, r, req.user),workshopTitle:store.workshops.find(w=>w.id===r.workshopId)?.title || ''}))})
  })
  app.get('/api/instructor/dashboard', instructor, (req,res) => {
    const owned=store.workshops.filter(w=>w.instructorId===req.user.id).map(w=>enrich(req, w, { owner: true }))
    const totalSeats=owned.reduce((s,w)=>s+w.capacity,0), reserved=owned.reduce((s,w)=>s+w.reserved,0)
    const rs=store.reviews.filter(r=>owned.some(w=>w.id===r.workshopId))
    res.json({ activeWorkshops:owned.filter(w=>w.published && !w.past).length, seatsReserved:reserved, capacity:totalSeats, occupancy:totalSeats?Math.round((reserved/totalSeats)*100):0, estimatedGross:owned.reduce((s,w)=>s+w.estimatedGross,0), averageRating:average(rs.map(r=>r.stars)), reviewCount:rs.length,
      byWorkshop:owned.map(w=>({id:w.id,title:w.title,date:w.date,past:w.past,reserved:w.reserved,capacity:w.capacity,occupancy:Math.round(w.reserved/w.capacity*100),estimatedGross:w.estimatedGross,enrollmentOpen:w.enrollmentOpen})) })
  })

  // Verificación de talleristas: la cuenta nueva queda "en revisión"; con el correo verificado envía una
  // solicitud (y, si quiere, indica qué local del directorio representa). El equipo la aprueba en /admin.
  app.post('/api/instructor/verification', instructor, verified('enviar tu solicitud'), writeLimit, serial, async (req,res) => {
    if (req.user.instructorStatus === 'approved') return error(res,409,'Tu cuenta ya está aprobada.')
    const { claimVenueId='', message='', contact='' } = req.body || {}
    if (typeof message !== 'string' || message.trim().length < 10 || message.length > 600) return error(res,400,'Cuéntanos sobre tu taller en 10 a 600 caracteres.')
    if (typeof contact !== 'string' || contact.length > 160) return error(res,400,'El dato de contacto es demasiado largo.')
    let venue = null
    if (claimVenueId) {
      venue = store.users.find(u => u.id === claimVenueId && u.role === 'instructor' && u.claimed === false && !u.archived)
      if (!venue) return error(res,404,'Ese local no está disponible para reclamar.')
    }
    const updated = { ...req.user, instructorStatus:'pending', rejectionReason:undefined,
      verificationRequest:{ claimVenueId: venue?.id || '', claimVenueName: venue?.studio?.displayName || venue?.name || '', message:message.trim(), contact:contact.trim(), submittedAt:new Date().toISOString() } }
    await persist('users', updated)
    Object.assign(req.user, updated)
    res.json({ user: meOut(req) })
  })

  // ---- Administración (correos en ADMIN_EMAILS) ----
  const adminView = (u) => ({ id:u.id, name:u.name, email:u.email, emailVerified:u.emailVerified !== false, instructorStatus:u.instructorStatus || 'pending', createdAt:u.createdAt || null,
    verificationRequest:u.verificationRequest || null, rejectionReason:u.rejectionReason || '', studioName:u.studio?.displayName || '', workshopCount:store.workshops.filter(w=>w.instructorId===u.id).length })
  app.get('/api/admin/instructors', admin, (req,res) => {
    const status = String(req.query.status || 'pending')
    const items = store.users.filter(u => u.role==='instructor' && u.claimed !== false && !u.archived && (status==='all' || (u.instructorStatus || 'pending')===status)).map(adminView)
      .sort((a,b)=>String(b.verificationRequest?.submittedAt||b.createdAt||'').localeCompare(String(a.verificationRequest?.submittedAt||a.createdAt||'')))
    res.json({ items, count: items.length })
  })
  app.post('/api/admin/instructors/:id/approve', admin, writeLimit, serial, async (req,res) => {
    const u = store.users.find(x => x.id===req.params.id && x.role==='instructor' && x.claimed !== false)
    if (!u) return error(res,404,'Tallerista no encontrado.')
    const transfer = req.body?.transferVenue !== false
    const venue = transfer && u.verificationRequest?.claimVenueId ? store.users.find(x => x.id===u.verificationRequest.claimVenueId && x.claimed===false && !x.archived) : null
    const updated = { ...u, instructorStatus:'approved', approvedAt:new Date().toISOString(), approvedBy:req.user.email, rejectionReason:undefined }
    const moved = []
    if (venue) {
      // Traspaso de la ficha del local: sus sesiones pasan a la cuenta aprobada y se completan los campos vacíos del perfil.
      updated.studio = { ...(venue.studio || {}), ...Object.fromEntries(Object.entries(u.studio || {}).filter(([,v]) => v !== '' && v !== null && v !== undefined && !(Array.isArray(v) && !v.length))) }
      for (const w of store.workshops.filter(w => w.instructorId===venue.id)) moved.push({ ...w, instructorId:u.id })
      for (const w of moved) await persist('workshops', w)
      await persist('users', { ...venue, archived:true, archivedReason:'reclamado', claimedBy:u.id })
    }
    await persist('users', updated)
    Object.assign(u, updated)
    if (venue) { Object.assign(venue, { archived:true, archivedReason:'reclamado', claimedBy:u.id }); for (const m of moved) Object.assign(store.workshops.find(w=>w.id===m.id), m) }
    res.json({ item: adminView(u), transferredWorkshops: moved.length, venue: venue?.id || null })
  })
  app.post('/api/admin/instructors/:id/reject', admin, writeLimit, serial, async (req,res) => {
    const u = store.users.find(x => x.id===req.params.id && x.role==='instructor' && x.claimed !== false)
    if (!u) return error(res,404,'Tallerista no encontrado.')
    const reason = String(req.body?.reason || '').trim()
    if (reason.length < 5 || reason.length > 400) return error(res,400,'Indica el motivo en 5 a 400 caracteres.')
    const updated = { ...u, instructorStatus:'rejected', rejectionReason:reason, reviewedAt:new Date().toISOString(), reviewedBy:req.user.email }
    await persist('users', updated)
    Object.assign(u, updated)
    res.json({ item: adminView(u) })
  })
  app.get('/api/admin/feedback', admin, (_req,res) => res.json({ items:(store.feedback||[]).slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)) }))

  // Directorio de locales y talleristas (Miraflores y Barranco), incluidas las fichas sin sesiones publicadas.
  app.get('/api/instructors', auth, (req,res) => {
    const { q='', district='' } = req.query
    const items=store.users.filter(u=>instructorVisible(u) && (u.claimed===false || u.instructorStatus==='approved')).map(u=>{
      const own=store.workshops.filter(w=>w.instructorId===u.id && w.published && !hasStarted(w))
      const zone=u.studio?.district || own[0]?.district || u.preferences?.district || ''
      return { id:u.id, name:u.studio?.displayName || u.name, tagline:u.studio?.tagline || '', district:zone, coverImage:imageUrl(req, u.studio?.coverImage || '', 'cover', u.id),
        instagram:u.studio?.links?.instagram || '', claimed:u.claimed!==false, verified:u.verified!==false, workshopCount:own.length,
        categories:[...new Set(own.map(w=>w.category))] }
    }).filter(x=>isDistrict(x.district) && (x.workshopCount || x.claimed===false))
      .filter(x=>!district || x.district===district)
      .filter(x=>!q || normalize([x.name,x.tagline,...x.categories].join(' ')).includes(normalize(q)))
      .sort((a,b)=>b.workshopCount-a.workshopCount || a.name.localeCompare(b.name,'es'))
    res.json({ items, count:items.length })
  })
  app.get('/api/instructors/:id', auth, (req,res) => {
    const user=store.users.find(u=>u.id===req.params.id)
    if (!instructorVisible(user, req.user)) return error(res,404,'Tallerista no encontrado.')
    const own=store.workshops.filter(w=>w.instructorId===user.id && w.published)
    const workshops=own.filter(w=>!hasStarted(w)).map(w=>enrich(req, w))
    const ids=new Set(own.map(w=>w.id))
    const all=store.reviews.filter(r=>ids.has(r.workshopId))
    const reviews=all.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,10).map(r=>({...publicReview(store, r, req.user),workshopTitle:own.find(w=>w.id===r.workshopId)?.title||''}))
    res.json({ item: {id:user.id, name:user.name, claimed:user.claimed!==false, verified:user.verified!==false, instructorStatus:user.instructorStatus || null, studio:studioOut(req, user)||{}, workshopCount:workshops.length, workshops, reviews,
      averageRating: average(all.map(r=>r.stars)), reviewCount: all.length } })
  })
  // Personalización: el tallerista decide colores, tipografía, distribución, textos, portada y enlaces.
  // Se guardan solo valores validados (nunca HTML/CSS libre) para evitar inyección de código.
  app.patch('/api/instructor/studio', instructor, writeLimit, serial, async (req,res) => {
    const body = req.body || {}
    const {displayName='',tagline='',bio='',link='',accent='terracota',accentColor='',font='moderna',layout='portada',links={},district='',address=''}=body
    const coverImage = resolveImage(store, body.coverImage ?? '')
    const gallery = Array.isArray(body.gallery) ? body.gallery.map(g => resolveImage(store, g)) : body.gallery ?? []
    const text=(v,max)=>typeof v==='string'&&v.length<=max
    if (!text(accentColor,7)||!text(district,40)||!text(coverImage,MAX_DATA_URI)) return error(res,400,'Revisa los datos del perfil del tallerista.')
    if (!text(displayName,90)||!text(tagline,140)||!text(bio,900)||!text(link,220)||!text(address,160) || !accents.includes(accent) || !fonts.includes(font) || !layouts.includes(layout)) return error(res,400,'Revisa los datos del perfil del tallerista.')
    if (accentColor && !/^#[0-9a-f]{6}$/i.test(accentColor)) return error(res,400,'El color personalizado debe tener formato #RRGGBB.')
    if (district && !isDistrict(district)) return error(res,400,'Selecciona Miraflores o Barranco.')
    if (coverImage && !validImage(coverImage)) return error(res,400,'Selecciona una foto de portada válida.')
    if (!Array.isArray(gallery) || gallery.length>6 || !gallery.every(validImage)) return error(res,400,'La galería admite hasta 6 imágenes válidas.')
    if (gallery.filter(isDataUri).length > 1 || (isDataUri(coverImage) && gallery.some(isDataUri))) return error(res,400,'Sube como máximo una foto propia por vez; usa enlaces HTTPS para el resto.')
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
    res.json({item:studioOut(req, req.user)})
  })
  app.post('/api/feedback', auth, writeLimit, serial, async (req,res) => {
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

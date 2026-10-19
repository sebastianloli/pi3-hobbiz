import express from 'express'
import cors from 'cors'
import { randomUUID, timingSafeEqual, scryptSync } from 'node:crypto'
import { categories, createSeedStore, districts, hashPassword, imageNames } from './data.js'

const safeUser = ({ passwordHash, ...user }) => user
const normalize = (s) => String(s ?? '').trim().toLocaleLowerCase('es-PE')
const round = (n) => Math.round(n * 10) / 10
const within = (n, min, max) => Number.isFinite(n) && n >= min && n <= max
const seatsBooked = (store, id) => store.bookings.filter(b => b.workshopId === id && b.status === 'confirmada').reduce((sum,b) => sum + b.seats, 0)
const feedback = (store, id) => store.reviews.filter(r => r.workshopId === id)
const enrich = (store, workshop) => {
  const reviews = feedback(store, workshop.id)
  const taken = seatsBooked(store, workshop.id)
  return { ...workshop, reserved: taken, available: Math.max(0, workshop.capacity - taken), rating: reviews.length ? round(reviews.reduce((s,v)=>s+v.stars,0)/reviews.length) : null, reviewCount: reviews.length, instructorName: store.users.find(u => u.id===workshop.instructorId)?.name ?? 'Tallerista de Hobbiz' }
}
const distanceKm = (a,b) => {
  const radians = v => (v*Math.PI)/180
  const dlat = radians(b[0]-a[0]), dlon=radians(b[1]-a[1])
  const x = Math.sin(dlat/2)**2 + Math.cos(radians(a[0]))*Math.cos(radians(b[0]))*Math.sin(dlon/2)**2
  return 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))
}
const getAuth = (req, store) => {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  const userId = store.sessions.get(token)
  return store.users.find(u => u.id===userId) || null
}
const error = (res, code, message) => res.status(code).json({ error: message })
const requireAuth = (store, role) => (req, res, next) => {
  req.user = getAuth(req, store)
  if (!req.user) return error(res,401,'Inicia sesión para continuar.')
  if (role && req.user.role !== role) return error(res,403,'No tienes permisos para realizar esta acción.')
  next()
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
  if (/^\/images\/[a-z0-9-]+\.jpg$/i.test(source)) return imageNames.includes(source.split('/').at(-1))
  return /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(source) && source.length < 1_600_000
}
function validateWorkshop(p) {
  const required = ['title','summary','description','category','district','venue','address','date','startsAt','endsAt','level','materialsIncluded','materialsBring','image']
  for (const field of required) if (typeof p[field] !== 'string' || !p[field].trim()) return `Completa el campo obligatorio: ${field}.`
  if (!categories.includes(p.category)) return 'La categoría no es válida.'
  if (!districts[p.district]) return 'Selecciona un distrito válido.'
  if (!within(Number(p.price), 0, 9999)) return 'El precio debe ser un número entre 0 y 9999.'
  if (!Number.isInteger(Number(p.capacity)) || !within(Number(p.capacity), 1, 1000)) return 'Los cupos deben ser un entero entre 1 y 1000.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date) || Number.isNaN(Date.parse(p.date))) return 'La fecha no es válida.'
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.startsAt) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.endsAt) || p.startsAt >= p.endsAt) return 'Indica un horario válido.'
  if (!validImage(p.image)) return 'Selecciona una foto válida (galería o JPG/PNG/WebP de hasta 1 MB).'
  return null
}
const publicWorkshop = (store, id) => {
  const found = store.workshops.find(w => w.id === id)
  return found ? enrich(store, found) : null
}

export function createApp(store = createSeedStore()) {
  const app = express()
  app.disable('x-powered-by')
  app.use(cors({ origin: process.env.CORS_ORIGIN || true }))
  app.use(express.json({ limit: '2mb' }))
  const auth = requireAuth(store)
  const instructor = requireAuth(store, 'instructor')

  app.get('/api/health', (_req,res) => res.json({ status: 'ok', mode: 'demo-memory', version:'1.0.0' }))
  app.get('/api/meta', (_req,res) => res.json({ categories, districts: Object.keys(districts), images: imageNames.map(i => `/images/${i}`) }))

  app.post('/api/auth/login', (req,res) => {
    const { email='', password='' } = req.body || {}
    const user = store.users.find(u => normalize(u.email) === normalize(email))
    if (!user || !checkPassword(password, user.passwordHash)) return error(res,401,'Credenciales incorrectas.')
    const token = randomUUID()
    store.sessions.set(token,user.id)
    res.json({ token, user: safeUser(user) })
  })
  app.post('/api/auth/register', (req,res) => {
    const { name='', email='', password='', role='client' } = req.body || {}
    if (String(name).trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) return error(res,400,'Ingresa nombre y correo válido.')
    if (String(password).length < 8) return error(res,400,'La contraseña debe tener al menos 8 caracteres.')
    if (!['client','instructor'].includes(role)) return error(res,400,'Tipo de cuenta inválido.')
    if (store.users.some(u => normalize(u.email) === normalize(email))) return error(res,409,'El correo ya está registrado.')
    const user = { id:randomUUID(), name:String(name).trim(), email:String(email).trim().toLowerCase(), passwordHash: hashPassword(password), role, preferences:{ interests:[], budget:100, district:'Miraflores', day:'' },favorites:[] }
    store.users.push(user)
    const token = randomUUID()
    store.sessions.set(token,user.id)
    res.status(201).json({ token, user:safeUser(user) })
  })
  app.post('/api/auth/logout', auth, (req,res) => { store.sessions.delete(req.headers.authorization.replace(/^Bearer\s+/i,''));res.status(204).end() })
  app.get('/api/auth/me', auth, (req,res) => res.json({user:safeUser(req.user)}))
  app.patch('/api/me', auth, (req,res) => {
    const { name, preferences } = req.body || {}
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2) return error(res,400,'Nombre inválido.')
      req.user.name = name.trim()
    }
    if (preferences !== undefined) {
      if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) return error(res,400,'Preferencias inválidas.')
      const { interests=[], budget=100, district='Miraflores', day='' } = preferences
      if (!Array.isArray(interests) || !interests.every(c => categories.includes(c)) || !within(Number(budget),0,9999) || !districts[district] || !['','sábado','domingo','lunes','martes','miércoles','jueves','viernes'].includes(day)) return error(res,400,'Revisa las preferencias ingresadas.')
      req.user.preferences = { interests, budget:Number(budget), district, day }
    }
    res.json({ user:safeUser(req.user) })
  })

  app.get('/api/workshops', (req,res) => {
    const { q='', category='', district='', maxPrice='', day='', near='', radiusKm='15' } = req.query
    let list = store.workshops.filter(w => w.published).map(w => enrich(store,w))
    if (q) list = list.filter(w => normalize([w.title,w.summary,w.description,w.category].join(' ')).includes(normalize(q)))
    if (category && category !== 'Todos') list = list.filter(w => w.category === category)
    if (district) list = list.filter(w => w.district === district)
    if (maxPrice !== '') list = list.filter(w => w.price <= Number(maxPrice))
    if (day) list = list.filter(w => {
      const names=['domingo','lunes','martes','miércoles','jueves','viernes','sábado']
      return names[new Date(`${w.date}T12:00:00Z`).getUTCDay()] === normalize(day)
    })
    if (near && districts[near]) {
      const maxKm = Number(radiusKm)
      list = list.map(w => ({ ...w, distanceKm:round(distanceKm(districts[near],districts[w.district])) })).filter(w => w.distanceKm <= (within(maxKm,1,100) ? maxKm : 15)).sort((a,b)=>a.distanceKm-b.distanceKm)
    }
    res.json({ items:list, count:list.length })
  })
  app.get('/api/recommendations', (req,res) => {
    const user = getAuth(req,store)
    const pref = user?.preferences || { interests:['Arte'], district:'Miraflores', budget:80 }
    const list = store.workshops.filter(w => w.published).map(w => {
      let score=0
      if (pref.interests?.includes(w.category)) score+=4
      if (w.price <= (pref.budget||100)) score+=2
      if (w.district === pref.district) score+=3
      else if (districts[w.district] && districts[pref.district] && distanceKm(districts[w.district],districts[pref.district]) < 5) score+=1
      return { ...enrich(store,w), matchScore:score }
    }).sort((a,b)=>b.matchScore-a.matchScore||a.price-b.price)
    res.json({ items:list.slice(0,4) })
  })
  app.get('/api/workshops/:id', (req,res) => {
    const w = publicWorkshop(store,req.params.id)
    if (!w || !w.published) return error(res,404,'Taller no encontrado.')
    res.json({ item:w })
  })
  app.get('/api/workshops/:id/reviews', (req,res) => {
    if (!publicWorkshop(store,req.params.id)) return error(res,404,'Taller no encontrado.')
    res.json({ items:feedback(store,req.params.id).slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)) })
  })
  app.post('/api/workshops/:id/reviews', auth, (req,res) => {
    if (req.user.role !== 'client') return error(res,403,'Solo los participantes pueden valorar.')
    if (!publicWorkshop(store,req.params.id)) return error(res,404,'Taller no encontrado.')
    const { stars, comment } = req.body || {}
    if (!Number.isInteger(Number(stars)) || !within(Number(stars),1,5) || typeof comment!=='string' || comment.trim().length < 8 || comment.trim().length > 500) return error(res,400,'Escribe una reseña de 8 a 500 caracteres y selecciona de 1 a 5 estrellas.')
    if (!store.bookings.some(b => b.workshopId===req.params.id && b.userId===req.user.id && b.status==='confirmada')) return error(res,403,'Solo puedes valorar talleres en los que tienes una reserva.')
    const existing = store.reviews.find(r => r.workshopId===req.params.id && r.userId===req.user.id)
    if (existing) {
      Object.assign(existing,{stars:Number(stars),comment:comment.trim(),createdAt:new Date().toISOString()})
      return res.json({item:existing})
    }
    const review = { id:randomUUID(), workshopId:req.params.id, userId:req.user.id, name:req.user.name, stars:Number(stars), comment:comment.trim(), createdAt:new Date().toISOString() }
    store.reviews.push(review)
    res.status(201).json({item:review})
  })

  app.get('/api/me/favorites', auth, (req,res) => res.json({items:req.user.favorites.map(id => publicWorkshop(store,id)).filter(Boolean)}))
  app.post('/api/me/favorites/:id', auth, (req,res) => {
    if (!publicWorkshop(store,req.params.id)) return error(res,404,'Taller no encontrado.')
    if (!req.user.favorites.includes(req.params.id)) req.user.favorites.push(req.params.id)
    res.json({ favorites:req.user.favorites })
  })
  app.delete('/api/me/favorites/:id', auth, (req,res) => {
    req.user.favorites = req.user.favorites.filter(id => id !== req.params.id)
    res.json({favorites:req.user.favorites})
  })
  app.get('/api/me/bookings', auth, (req,res) => res.json({items:store.bookings.filter(b=>b.userId===req.user.id).map(b=>({...b,workshop:publicWorkshop(store,b.workshopId)})).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))}))
  app.post('/api/workshops/:id/bookings', auth, (req,res) => {
    if (req.user.role !== 'client') return error(res,403,'Solo los clientes pueden reservar talleres.')
    const w = store.workshops.find(w=>w.id===req.params.id && w.published)
    if (!w) return error(res,404,'Taller no encontrado.')
    const seats=Number(req.body?.seats ?? 1)
    if (!Number.isInteger(seats) || !within(seats,1,10)) return error(res,400,'Selecciona entre 1 y 10 cupos.')
    // La validación y el registro son síncronos en esta demo de un único proceso Node.js.
    if (seats > w.capacity - seatsBooked(store,w.id)) return error(res,409,'No quedan suficientes cupos disponibles.')
    const booking={ id:randomUUID(), workshopId:w.id, userId:req.user.id, seats, status:'confirmada', createdAt:new Date().toISOString() }
    store.bookings.push(booking)
    res.status(201).json({item:booking,workshop:enrich(store,w)})
  })

  app.get('/api/instructor/workshops', instructor, (req,res) => res.json({items:store.workshops.filter(w => w.instructorId===req.user.id).map(w => enrich(store,w))}))
  app.post('/api/instructor/workshops', instructor, (req,res) => {
    const msg=validateWorkshop(req.body || {})
    if (msg) return error(res,400,msg)
    const p=req.body
    const w={ id:randomUUID(), instructorId:req.user.id, published:true, currency:'PEN', ...Object.fromEntries(['title','summary','description','category','district','venue','address','date','startsAt','endsAt','level','materialsIncluded','materialsBring','image'].map(k=>[k,p[k].trim()])), price:Number(p.price), capacity:Number(p.capacity) }
    store.workshops.push(w)
    res.status(201).json({item:enrich(store,w)})
  })
  app.put('/api/instructor/workshops/:id', instructor, (req,res) => {
    const w=store.workshops.find(w => w.id===req.params.id && w.instructorId===req.user.id)
    if (!w) return error(res,404,'No existe el taller o no te pertenece.')
    const payload={...w,...req.body}
    const msg=validateWorkshop(payload)
    if (msg) return error(res,400,msg)
    if (Number(payload.capacity) < seatsBooked(store,w.id)) return error(res,409,'No puedes reducir cupos por debajo de las reservas confirmadas.')
    Object.assign(w, Object.fromEntries(['title','summary','description','category','district','venue','address','date','startsAt','endsAt','level','materialsIncluded','materialsBring','image'].map(k=>[k,payload[k].trim()])), { price:Number(payload.price),capacity:Number(payload.capacity), published:payload.published !== false })
    res.json({item:enrich(store,w)})
  })
  app.delete('/api/instructor/workshops/:id', instructor, (req,res) => {
    const idx=store.workshops.findIndex(w=>w.id===req.params.id && w.instructorId===req.user.id)
    if (idx<0) return error(res,404,'Taller no encontrado.')
    if (seatsBooked(store,req.params.id)) return error(res,409,'No se puede eliminar un taller con reservas; edítalo o despublícalo.')
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
    res.json({ activeWorkshops:owned.filter(w=>w.published).length, seatsReserved:reserved, capacity:totalSeats, occupancy:totalSeats?Math.round((reserved/totalSeats)*100):0, estimatedGross:owned.reduce((s,w)=>s+w.reserved*w.price,0), averageRating:rs.length?round(rs.reduce((s,r)=>s+r.stars,0)/rs.length):null, reviewCount:rs.length, byWorkshop:owned.map(w=>({id:w.id,title:w.title,reserved:w.reserved,capacity:w.capacity,occupancy:Math.round(w.reserved/w.capacity*100)})) })
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

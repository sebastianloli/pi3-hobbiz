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
  return { ...workshop, reserved: taken, available: Math.max(0, workshop.capacity - taken), rating: reviews.length ? round(reviews.reduce((s,v)=>s+v.stars,0)/reviews.length) : null, reviewCount: reviews.length, instructorName: store.users.find(u => u.id===workshop.instructorId)?.studio?.displayName || store.users.find(u => u.id===workshop.instructorId)?.name || 'Tallerista de Hobbiz', instructorStudio:store.users.find(u=>u.id===workshop.instructorId)?.studio || null }
}
function workshopLocation(workshop) {
  if (
    within(workshop.latitude, -90, 90) &&
    within(workshop.longitude, -180, 180)
  ) {
    return [workshop.latitude, workshop.longitude];
  }

  return districts[workshop.district];
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
  if (/^\/images\/[a-z0-9-]+\.jpg$/i.test(source)) return imageNames.includes(source.split('/').at(-1))
  return /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(source) && source.length < 1_600_000
}
function isValidDate(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(`${value}T12:00:00Z`);

  if (!Number.isFinite(date.getTime())) {
    return false;
  }

  return date.toISOString().slice(0, 10) === value;
}
function validateWorkshop(p) {
  const required = ['title','summary','description','category','district','venue','address','date','startsAt','endsAt','level','materialsIncluded','materialsBring','image']
  for (const field of required) if (typeof p[field] !== 'string' || !p[field].trim()) return `Completa el campo obligatorio: ${field}.`
  if (!categories.includes(p.category)) return 'La categoría no es válida.'
  if (!districts[p.district]) return 'Selecciona un distrito válido.'
  if (!within(Number(p.price), 0, 9999)) return 'El precio debe ser un número entre 0 y 9999.'
  if (!Number.isInteger(Number(p.capacity)) || !within(Number(p.capacity), 1, 1000)) return 'Los cupos deben ser un entero entre 1 y 1000.'
  if (!isValidDate(p.date)) {return 'Selecciona una fecha que exista.';}  
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.startsAt) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.endsAt) || p.startsAt >= p.endsAt) return 'Indica un horario válido.'
  if (
  (p.latitude != null || p.longitude != null) &&
  (
    !within(p.latitude, -90, 90) ||
    !within(p.longitude, -180, 180)
  )
) {
  return 'Completa la latitud y la longitud con números válidos.';
}
  if (!validImage(p.image)) return 'Selecciona una foto válida (galería o JPG/PNG/WebP de hasta 1 MB).'
  return null
}
const publicWorkshop = (store, id) => {
  const found = store.workshops.find(w => w.id === id)
  return found ? enrich(store, found) : null
}

export function createApp(store = createSeedStore(), options = {}) {
  const mode = options.mode || 'demo'
  const persistent = mode === 'firebase-mongo'
  let reservationQueue = Promise.resolve()
  const reserveSerially = fn => {
    const result = reservationQueue.then(fn,fn)
    reservationQueue = result.catch(()=>{})
    return result
  }
  const persist = async (kind, record) => { if (options.persistOne) await options.persistOne(kind, record) }
  const removePersisted = async (kind, id) => { if (options.removeOne) await options.removeOne(kind, id) }

  const app = express()
  app.disable('x-powered-by')
  app.use(cors({ origin: process.env.CORS_ORIGIN || (persistent ? 'http://localhost:5173' : true) }))
  app.use(express.json({ limit: '2mb' }))
  let mutationTail = Promise.resolve();
  app.use('/api', (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    const previous = mutationTail;
    let release;

    mutationTail = new Promise(resolve => {
      release = resolve;
    });

    previous.then(() => {
      let released = false;

      const finish = () => {
        if (!released) {
          released = true;
          release();
        }
      };

      const originalEnd = res.end.bind(res);

      res.end = (...args) => {
        try {
          return originalEnd(...args);
        } finally {
          finish();
        }
      };

      next();
    }).catch(next);
  });
  const auth = requireAuth(store, undefined, options)
  const instructor = requireAuth(store, 'instructor', options)

  app.get('/api/health', (_req,res) => res.json({ status: 'ok', mode, version:'2.0.0' }))
  app.get('/api/meta', (_req,res) => res.json({ categories, districts: Object.keys(districts), images: imageNames.map(i => `/images/${i}`) }))

  app.post('/api/auth/login', (req,res) => {
    if (persistent) return error(res, 409, 'Usa Firebase Authentication para acceder.')
    const { email='', password='' } = req.body || {}
    const user = store.users.find(u => normalize(u.email) === normalize(email))
    if (!user || !checkPassword(password, user.passwordHash)) return error(res,401,'Credenciales incorrectas.')
    const token = randomUUID()
    store.sessions.set(token,user.id)
    res.json({ token, user: safeUser(user) })
  })
  app.post('/api/auth/register', (req,res) => {
    if (persistent) return error(res, 409, 'Usa Firebase Authentication para registrarte.')
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
  app.patch('/api/me', auth, async (req, res, next) => {
    try {
      const { name, preferences } = req.body || {};
      const updated = { ...req.user };

      if (name !== undefined) {
        if (
          typeof name !== 'string' ||
          name.trim().length < 2 ||
          name.trim().length > 100
        ) {
          return error(
            res,
            400,
            'Escribe un nombre de entre 2 y 100 caracteres.'
          );
        }

        updated.name = name.trim();
      }

      if (preferences !== undefined) {
        if (
          !preferences ||
          typeof preferences !== 'object' ||
          Array.isArray(preferences)
        ) {
          return error(res, 400, 'Preferencias inválidas.');
        }

        const {
          interests = [],
          budget = 100,
          district = 'Miraflores',
          day = ''
        } = preferences;

        const days = [
          '',
          'lunes',
          'martes',
          'miércoles',
          'jueves',
          'viernes',
          'sábado',
          'domingo'
        ];

        if (
          !Array.isArray(interests) ||
          !interests.every(category => categories.includes(category)) ||
          !within(Number(budget), 0, 9999) ||
          !Object.hasOwn(districts, district) ||
          !days.includes(day)
        ) {
          return error(res, 400, 'Revisa las preferencias ingresadas.');
        }

        updated.preferences = {
          interests,
          budget: Number(budget),
          district,
          day
        };
      }

      await persist('users', updated);

      Object.assign(req.user, updated);

      res.json({ user: safeUser(req.user) });
    } catch (err) {
      next(err);
    }
  });
  app.get('/api/workshops', (req,res) => {
    const { q='', category='', district='', maxPrice='', day='', near='', lat='', lon='', radiusKm='15' } = req.query
    let list = store.workshops.filter(w => w.published).map(w => enrich(store,w))
    // Agotados ocultos salvo cuando el usuario escribe el nombre exacto del taller.
    list = list.filter(w => w.available > 0 || (q && normalize(w.title) === normalize(q)))
    if (q) list = list.filter(w => normalize([w.title,w.summary,w.description,w.category].join(' ')).includes(normalize(q)))
    if (category && category !== 'Todos') list = list.filter(w => w.category === category)
    if (district) list = list.filter(w => w.district === district)
    if (maxPrice !== '') list = list.filter(w => w.price <= Number(maxPrice))
    if (day) list = list.filter(w => {
      const names=['domingo','lunes','martes','miércoles','jueves','viernes','sábado']
      return names[new Date(`${w.date}T12:00:00Z`).getUTCDay()] === normalize(day)
    })
    const {
      startsAfter = '',
      endsBefore = ''
    } = req.query;

    const validTime = /^([01]\d|2[0-3]):[0-5]\d$/;

    if (
      typeof startsAfter !== 'string' ||
      typeof endsBefore !== 'string' ||
      (startsAfter && !validTime.test(startsAfter)) ||
      (endsBefore && !validTime.test(endsBefore))
    ) {
      return error(res, 400, 'Revisa las horas seleccionadas.');
    }

    if (startsAfter && endsBefore && startsAfter >= endsBefore) {
      return error(
        res,
        400,
        'La hora inicial debe ser anterior a la hora final.'
      );
    }

    if (startsAfter) {
      list = list.filter(workshop =>
        workshop.startsAt >= startsAfter
      );
    }

    if (endsBefore) {
      list = list.filter(workshop =>
        workshop.endsAt <= endsBefore
      );
    }
    if (lat !== '' || lon !== '') {
      const a=Number(lat), b=Number(lon),maxKm=Number(radiusKm)
      if(!within(a,-90,90)||!within(b,-180,180))return error(res,400,'Coordenadas GPS no válidas.')
      list=list.map(w=>({...w,distanceKm:round(distanceKm([a,b],workshopLocation(w)))})).filter(w=>w.distanceKm<=(within(maxKm,1,100)?maxKm:15)).sort((x,y)=>x.distanceKm-y.distanceKm)
    } else if (near && districts[near]) {
      const maxKm = Number(radiusKm)
      list = list.map(w => ({ ...w, distanceKm:round(distanceKm(districts[near],workshopLocation(w))) })).filter(w => w.distanceKm <= (within(maxKm,1,100) ? maxKm : 15)).sort((a,b)=>a.distanceKm-b.distanceKm)
    }
    res.json({ items:list, count:list.length })
  })
  app.get('/api/recommendations', async (req,res) => {
    let user = getAuth(req,store)
    if (persistent && req.headers.authorization) {
      try { const decoded = await options.verifyIdToken(String(req.headers.authorization).replace(/^Bearer\s+/i,'')); user = store.users.find(u=>u.id===decoded.uid) } catch { user = null }
    }
    const pref = user?.preferences || { interests:['Arte'], district:'Miraflores', budget:80 }
    const list = store.workshops.filter(w => w.published && w.capacity > seatsBooked(store,w.id)).map(w => {
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
  app.post('/api/workshops/:id/reviews', auth, async (req, res, next) => {
    try {
      if (req.user.role !== 'client') {
        return error(res, 403, 'Solo los participantes pueden valorar.');
      }

      const workshop = publicWorkshop(store, req.params.id);

      if (!workshop) {
        return error(res, 404, 'Taller no encontrado.');
      }

      const { stars, comment } = req.body || {};
      const rating = Number(stars);

      if (
        !Number.isInteger(rating) ||
        !within(rating, 1, 5) ||
        typeof comment !== 'string' ||
        comment.trim().length < 8 ||
        comment.trim().length > 500
      ) {
        return error(
          res,
          400,
          'Selecciona de 1 a 5 estrellas y escribe entre 8 y 500 caracteres.'
        );
      }

      const hasBooking = store.bookings.some(booking =>
        booking.workshopId === req.params.id &&
        booking.userId === req.user.id &&
        booking.status === 'confirmada'
      );

      if (!hasBooking) {
        return error(
          res,
          403,
          'Solo puedes valorar talleres en los que tienes una reserva.'
        );
      }

      const existing = store.reviews.find(review =>
        review.workshopId === req.params.id &&
        review.userId === req.user.id
      );

      if (existing) {
        const updated = {
          ...existing,
          name: req.user.name,
          stars: rating,
          comment: comment.trim(),
          createdAt: new Date().toISOString()
        };

        await persist('reviews', updated);

        Object.assign(existing, updated);

        return res.json({ item: existing });
      }

      const review = {
        id: randomUUID(),
        workshopId: req.params.id,
        userId: req.user.id,
        name: req.user.name,
        stars: rating,
        comment: comment.trim(),
        createdAt: new Date().toISOString()
      };

      await persist('reviews', review);

      store.reviews.push(review);

      res.status(201).json({ item: review });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/me/favorites', auth, (req,res) => res.json({items:req.user.favorites.map(id => publicWorkshop(store,id)).filter(Boolean)}))
  app.post('/api/me/favorites/:id', auth, async (req, res, next) => {
    try {
      const workshop = publicWorkshop(store, req.params.id);

      if (!workshop) {
        return error(res, 404, 'Taller no encontrado.');
      }

      const favorites = [...(req.user.favorites || [])];

      if (!favorites.includes(req.params.id)) {
        favorites.push(req.params.id);
      }

      const updated = {
        ...req.user,
        favorites
      };

      await persist('users', updated);

      req.user.favorites = favorites;

      res.json({ favorites });
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/me/favorites/:id', auth, async (req, res, next) => {
    try {
      const favorites = (req.user.favorites || []).filter(
        id => id !== req.params.id
      );

      const updated = {
        ...req.user,
        favorites
      };

      await persist('users', updated);

      req.user.favorites = favorites;

      res.json({ favorites });
    } catch (err) {
      next(err);
    }
  });
  app.get('/api/me/bookings', auth, (req,res) => res.json({items:store.bookings.filter(b=>b.userId===req.user.id).map(b=>({...b,workshop:publicWorkshop(store,b.workshopId)})).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))}))
  app.post('/api/workshops/:id/bookings', auth, async (req,res) => {
    if (req.user.role !== 'client') return error(res,403,'Solo los clientes pueden reservar talleres.')
    const seats=Number(req.body?.seats ?? 1)
    if (!Number.isInteger(seats) || !within(seats,1,10)) return error(res,400,'Selecciona entre 1 y 10 cupos.')
    // Serializado dentro de un único backend para impedir sobreventa durante escrituras async.
    // Una futura implementación distribuida debe usar transacciones MongoDB.
    return reserveSerially(async()=>{
      const w=store.workshops.find(w=>w.id===req.params.id && w.published)
      if (!w) return error(res,404,'Taller no encontrado.')
      if (seats > w.capacity - seatsBooked(store,w.id)) return error(res,409,'No quedan suficientes cupos disponibles.')
      const booking={id:randomUUID(),workshopId:w.id,userId:req.user.id,seats,status:'confirmada',createdAt:new Date().toISOString()}
      await persist('bookings',booking)
      store.bookings.push(booking)
      return res.status(201).json({item:booking,workshop:enrich(store,w)})
    })
  })

  app.get('/api/instructor/workshops', instructor, (req,res) => res.json({items:store.workshops.filter(w => w.instructorId===req.user.id).map(w => enrich(store,w))}))
  app.post('/api/instructor/workshops', instructor, async (req,res) => {
      const msg=validateWorkshop(req.body || {})
      if (msg) return error(res,400,msg)
      const p=req.body
      const w={ id:randomUUID(), instructorId:req.user.id, published:true, currency:'PEN', ...Object.fromEntries(['title','summary','description','category','district','venue','address','date','startsAt','endsAt','level','materialsIncluded','materialsBring','image'].map(k=>[k,p[k].trim()])), price:Number(p.price), capacity:Number(p.capacity) }
      // Sesiones recurrentes semanales: instancias independientes con sus propios cupos.
      w.latitude = p.latitude ?? null;
      w.longitude = p.longitude ?? null;  
      const count = p.recurrence === 'weekly' ? Number(p.repeatCount || 1) : 1
      if (!Number.isInteger(count) || count < 1 || count > 8) return error(res,400,'Máximo 8 sesiones semanales.')
      if (p.recurrence && !['once','weekly'].includes(p.recurrence)) return error(res,400,'Recurrencia inválida.')
      const seriesId = count > 1 ? randomUUID() : null
      const created = [];
      for (let i = 0; i < count; i++) {
        const date = new Date(`${w.date}T12:00:00Z`);

        date.setUTCDate(date.getUTCDate() + i * 7);

        const sessionDate = date.toISOString().slice(0, 10);

        if (!isValidDate(sessionDate)) {
          return error(
            res,
            400,
            'Una de las fechas generadas no es válida.'
          );
        }

        const session = {
          ...w,
          id: i === 0 ? w.id : randomUUID(),
          date: sessionDate,
          recurrenceGroupId: seriesId,
          recurrence: count > 1 ? 'weekly' : 'once',
          repeatCount: count
        };

        created.push(session);
      }

      if (options.persistMany) {
        await options.persistMany('workshops', created);
      } else if (created.length === 1) {
        await persist('workshops', created[0]);
      } else if (persistent || options.persistOne) {
        throw new Error(
          'Falta conectar el guardado conjunto de las sesiones.'
        );
      }

      store.workshops.push(...created);

      res.status(201).json({
        item: enrich(store, created[0]),
        createdCount: created.length
      });
    })
    app.put('/api/instructor/workshops/:id', instructor, async (req, res, next) => {
    try {
      const workshop = store.workshops.find(item =>
        item.id === req.params.id &&
        item.instructorId === req.user.id
      );

      if (!workshop) {
        return error(
          res,
          404,
          'No existe el taller o no te pertenece.'
        );
      }

      const payload = {
        ...workshop,
        ...(req.body || {})
      };

      const message = validateWorkshop(payload);

      if (message) {
        return error(res, 400, message);
      }

      const reserved = seatsBooked(store, workshop.id);

      if (Number(payload.capacity) < reserved) {
        return error(
          res,
          409,
          'No puedes reducir los cupos por debajo de las reservas confirmadas.'
        );
      }

      const fields = [
        'title',
        'summary',
        'description',
        'category',
        'district',
        'venue',
        'address',
        'date',
        'startsAt',
        'endsAt',
        'level',
        'materialsIncluded',
        'materialsBring',
        'image'
      ];

      const updated = { ...workshop };

      for (const field of fields) {
        updated[field] = payload[field].trim();
      }

      updated.price = Number(payload.price);
      updated.capacity = Number(payload.capacity);
      updated.published = payload.published !== false;
      updated.latitude = payload.latitude ?? null;
      updated.longitude = payload.longitude ?? null;

      await persist('workshops', updated);

      Object.assign(workshop, updated);

      res.json({ item: enrich(store, workshop) });
    } catch (err) {
      next(err);
    }
  });
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
    res.json({ activeWorkshops:owned.filter(w=>w.published).length, seatsReserved:reserved, capacity:totalSeats, occupancy:totalSeats?Math.round((reserved/totalSeats)*100):0, estimatedGross:owned.reduce((s,w)=>s+w.reserved*w.price,0), averageRating:rs.length?round(rs.reduce((s,r)=>s+r.stars,0)/rs.length):null, reviewCount:rs.length, byWorkshop:owned.map(w=>({id:w.id,title:w.title,reserved:w.reserved,capacity:w.capacity,occupancy:Math.round(w.reserved/w.capacity*100)})) })
  })

  // Perfil público y personalización sencilla del tallerista (sin diseñador arbitrario de HTML).
  app.get('/api/instructors/:id', (req,res) => {
    const user=store.users.find(u=>u.id===req.params.id && u.role==='instructor')
    if (!user) return error(res,404,'Tallerista no encontrado.')
    res.json({ item: {id:user.id, name:user.name, studio:user.studio||{},
      workshopCount:store.workshops.filter(w=>w.instructorId===user.id && w.published).length } })
  })
  app.patch('/api/instructor/studio', instructor, async (req, res, next) => {
  try {
    const {
      displayName = '',
      bio = '',
      link = '',
      accent = 'terracota',
      coverImage = ''
    } = req.body || {};

    if (
      typeof displayName !== 'string' ||
      displayName.length > 90 ||
      typeof bio !== 'string' ||
      bio.length > 900 ||
      typeof link !== 'string' ||
      link.length > 220 ||
      typeof coverImage !== 'string' ||
      !['terracota', 'oliva', 'azul'].includes(accent)
    ) {
      return error(
        res,
        400,
        'Revisa los datos del perfil del tallerista.'
      );
    }

    if (coverImage && !validImage(coverImage)) {
      return error(
        res,
        400,
        'Selecciona una foto de portada válida.'
      );
    }

    const cleanLink = link.trim();

    if (
      cleanLink &&
      !/^https:\/\/[a-z0-9.-]+(?:\/[A-Za-z0-9/?#&=_.%~-]*)?$/i.test(cleanLink)
    ) {
      return error(
        res,
        400,
        'Introduce un enlace válido que comience con https://'
      );
    }

    const studio = {
      displayName: displayName.trim(),
      bio: bio.trim(),
      link: cleanLink,
      accent,
      coverImage
    };

    const updated = {
      ...req.user,
      studio
    };

    await persist('users', updated);

    req.user.studio = studio;

    res.json({ item: studio });
  } catch (err) {
    next(err);
  }
});
  app.post('/api/feedback', auth, async (req,res) => {
    const {rating,comment,area='general'}=req.body||{}
    if (!Number.isInteger(Number(rating)) || Number(rating)<1 || Number(rating)>5 || typeof comment!=='string' || comment.trim().length<10 || comment.length>1000 || !['general','busqueda','reserva','tallerista'].includes(area)) return error(res,400,'Califica de 1 a 5 y deja un comentario de 10 a 1000 caracteres.')
    const item={id:randomUUID(),userId:req.user.id,role:req.user.role,area,rating:Number(rating),comment:comment.trim(),createdAt:new Date().toISOString()}
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

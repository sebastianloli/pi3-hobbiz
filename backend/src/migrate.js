import { districts, insideArea, isDistrict, accents, venueSeed, excludedVenueIds } from './data.js'

// Cuenta de Instagram de un perfil (para reconocer el mismo local aunque se haya cargado con otro id).
export function instagramHandle(user) {
  try {
    const url = new URL(user?.studio?.links?.instagram || user?.studio?.link || '')
    if (!['instagram.com', 'www.instagram.com'].includes(url.hostname.toLowerCase())) return ''
    return url.pathname.split('/').filter(Boolean)[0]?.toLowerCase() || ''
  } catch { return '' }
}
const empty = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)

// Migración idempotente de datos existentes en MongoDB al modelo actual (Miraflores/Barranco + mapa).
// Es una función pura: recibe las colecciones leídas y devuelve qué documentos cambiar. db.js la aplica.
// `insert`: además de corregir, inserta las fichas de locales que falten (MONGODB_SEED_CATALOG=true o npm run db:seed).
export function planMigration(store, { seed = venueSeed(), insert = false } = {}) {
  const changed = { users: new Map(), workshops: new Map(), bookings: new Map() }
  const report = { sampleRedated: 0, instructorsApproved: 0, coordsRenamed: 0, coordsFromDistrict: 0, outOfArea: 0, orphaned: 0, usersFixed: 0, bookingsAmount: 0, venuesEnriched: 0, venuesArchived: 0, seededUsers: 0, seededWorkshops: 0 }
  const userIds = new Set(store.users.map(u => u.id))
  const today = new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10)
  const seedById = new Map(seed.users.map(u => [u.id, u]))
  const seedByHandle = new Map(seed.users.map(u => [instagramHandle(u), u]))

  for (const w of store.workshops) {
    const next = { ...w }
    // La rama de Santiago guardaba latitude/longitude (opcionales); el modelo actual usa lat/lon obligatorios.
    if (next.lat === undefined && Number.isFinite(next.latitude)) { next.lat = next.latitude; next.lon = next.longitude; report.coordsRenamed++ }
    delete next.latitude; delete next.longitude
    if (!isDistrict(next.district)) {
      // Talleres del MVP anterior en otros distritos: se ocultan, no se borran (pueden tener reservas).
      if (next.published !== false || next.archivedReason !== 'fuera-de-zona') { next.published = false; next.archivedReason = 'fuera-de-zona'; report.outOfArea++ }
    } else if (!insideArea(next.district, Number(next.lat), Number(next.lon))) {
      ;[next.lat, next.lon] = districts[next.district]
      next.locationPrecision = 'distrito'
      report.coordsFromDistrict++
    }
    if (excludedVenueIds.has(next.instructorId) && next.archivedReason !== 'fuera-de-zona') { next.published = false; next.archivedReason = 'fuera-de-zona'; report.outOfArea++ }
    if (!userIds.has(next.instructorId) && next.archivedReason !== 'sin-tallerista' && next.archivedReason !== 'fuera-de-zona') {
      // Fichas de la semilla vieja (p. ej. "otro-1") que no pertenecen a ninguna cuenta real.
      next.published = false; next.archivedReason = 'sin-tallerista'; report.orphaned++
    }
    if (next.enrollmentOpen === undefined) next.enrollmentOpen = true
    // Sesiones de ejemplo vencidas y sin reservas: se mueven a la próxima semana equivalente (mismo día de la semana),
    // para que el catálogo de la demo no quede vacío con el paso de las semanas.
    if (next.sampleData && next.date < today && !store.bookings.some(b => b.workshopId === next.id)) {
      const d = new Date(`${next.date}T12:00:00Z`)
      const weeks = Math.floor((Date.parse(`${today}T12:00:00Z`) - d.getTime()) / (7 * 86400000)) + 1
      d.setUTCDate(d.getUTCDate() + weeks * 7)
      next.date = d.toISOString().slice(0, 10)
      report.sampleRedated++
    }
    if (JSON.stringify(next) !== JSON.stringify(w)) changed.workshops.set(next.id, next)
  }

  for (const u of store.users) {
    const next = { ...u, preferences: { interests: [], budget: 100, district: 'Miraflores', day: '', ...(u.preferences || {}) }, favorites: Array.isArray(u.favorites) ? u.favorites : [] }
    if (!isDistrict(next.preferences.district)) next.preferences.district = 'Miraflores'
    if (next.studio) {
      next.studio = { ...next.studio }
      if (!accents.includes(next.studio.accent)) next.studio.accent = 'terracota'
      if (next.studio.district && !isDistrict(next.studio.district)) next.studio.district = ''
      if (!next.studio.links && next.studio.link) next.studio.links = { web: next.studio.link }
    }
    // Talleristas que ya existían antes de la verificación: quedan aprobados para no bloquear sus cuentas.
    if (next.role === 'instructor' && next.claimed !== false && !next.instructorStatus) { next.instructorStatus = 'approved'; report.instructorsApproved++ }
    const fixed = JSON.stringify(next) !== JSON.stringify(u)
    if (next.role === 'instructor' && next.claimed === false) {
      // Locales del PDF fuera de Miraflores/Barranco que una carga anterior insertó: se archivan.
      if (excludedVenueIds.has(next.id) && !next.archived) { next.archived = true; next.archivedReason = 'fuera-de-zona'; report.venuesArchived++ }
      // Fichas vacías (p. ej. de backend/scripts/cargar-locales.mjs): se completan SOLO los campos vacíos con la investigación.
      const base = seedById.get(next.id) || seedByHandle.get(instagramHandle(next))
      if (base && !next.archived) {
        const before = JSON.stringify(next)
        next.studio = { ...(next.studio || {}) }
        for (const [k, v] of Object.entries(base.studio)) if (empty(next.studio[k]) && !empty(v)) next.studio[k] = v
        next.studio.links = { ...base.studio.links, ...(next.studio.links || {}) }
        // Nombres con erratas del PDF ("Wegner", "MiCoAcuarlaIlustracion"...) se reemplazan por el nombre verificado.
        if (next.importSource === 'talleres.pdf' && next.name !== base.name) { next.name = base.name; if (next.studio.displayName !== base.studio.displayName) next.studio.displayName = base.studio.displayName }
        if (base.verified === false && next.verified === undefined) next.verified = false
        if (JSON.stringify(next) !== before) report.venuesEnriched++
      }
    }
    if (JSON.stringify(next) !== JSON.stringify(u)) { changed.users.set(next.id, next); if (fixed) report.usersFixed++ }
  }

  const workshopsById = new Map([...store.workshops, ...changed.workshops.values()].map(w => [w.id, w]))
  for (const b of store.bookings) {
    if (Number.isFinite(b.amount)) continue
    const price = workshopsById.get(b.workshopId)?.price || 0
    changed.bookings.set(b.id, { ...b, unitPrice: price, amount: price * b.seats }); report.bookingsAmount++
  }

  // Fichas de los locales: solo se insertan las que faltan, nunca se pisan las editadas. Un local que ya existe
  // con otro id pero el mismo Instagram se reutiliza (sus sesiones se asignan a ese perfil).
  const inserts = { users: [], workshops: [] }
  if (insert) {
    const ownerByHandle = new Map(store.users.filter(u => u.role === 'instructor').map(u => [instagramHandle(u), u.id]).filter(([h]) => h))
    const owner = new Map()
    for (const u of seed.users) {
      const existing = userIds.has(u.id) ? u.id : ownerByHandle.get(instagramHandle(u))
      if (existing) { owner.set(u.id, existing); continue }
      inserts.users.push(u); owner.set(u.id, u.id); report.seededUsers++
    }
    const existingWorkshops = new Set(store.workshops.map(w => w.id))
    for (const w of seed.workshops.filter(w => !existingWorkshops.has(w.id))) { inserts.workshops.push({ ...w, instructorId: owner.get(w.instructorId) || w.instructorId }); report.seededWorkshops++ }
  }
  return { updates: { users: [...changed.users.values()], workshops: [...changed.workshops.values()], bookings: [...changed.bookings.values()] }, inserts, report }
}

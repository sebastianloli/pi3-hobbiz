import { districts, insideArea, isDistrict, accents } from './data.js'

// Migración idempotente de datos existentes en MongoDB al modelo actual (Miraflores/Barranco + mapa).
// Es una función pura: recibe las colecciones leídas y devuelve qué documentos cambiar. db.js la aplica.
export function planMigration(store, seed = null) {
  const changed = { users: new Map(), workshops: new Map(), bookings: new Map() }
  const report = { coordsRenamed: 0, coordsFromDistrict: 0, outOfArea: 0, orphaned: 0, usersFixed: 0, bookingsAmount: 0, seededUsers: 0, seededWorkshops: 0 }
  const userIds = new Set(store.users.map(u => u.id))

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
    if (!userIds.has(next.instructorId) && next.archivedReason !== 'sin-tallerista' && next.archivedReason !== 'fuera-de-zona') {
      // Fichas de la semilla vieja (p. ej. "otro-1") que no pertenecen a ninguna cuenta real.
      next.published = false; next.archivedReason = 'sin-tallerista'; report.orphaned++
    }
    if (next.enrollmentOpen === undefined) next.enrollmentOpen = true
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
    if (JSON.stringify(next) !== JSON.stringify(u)) { changed.users.set(next.id, next); report.usersFixed++ }
  }

  const workshopsById = new Map([...store.workshops, ...changed.workshops.values()].map(w => [w.id, w]))
  for (const b of store.bookings) {
    if (Number.isFinite(b.amount)) continue
    const price = workshopsById.get(b.workshopId)?.price || 0
    changed.bookings.set(b.id, { ...b, unitPrice: price, amount: price * b.seats }); report.bookingsAmount++
  }

  // Fichas de los 24 talleres reales: solo se insertan las que faltan, nunca se pisan las editadas.
  const inserts = { users: [], workshops: [] }
  if (seed) {
    const existingWorkshops = new Set(store.workshops.map(w => w.id))
    for (const u of seed.users.filter(u => u.id.startsWith('venue-') && !userIds.has(u.id))) { inserts.users.push(u); report.seededUsers++ }
    for (const w of seed.workshops.filter(w => w.instructorId.startsWith('venue-') && !existingWorkshops.has(w.id))) { inserts.workshops.push(w); report.seededWorkshops++ }
  }
  return { updates: { users: [...changed.users.values()], workshops: [...changed.workshops.values()], bookings: [...changed.bookings.values()] }, inserts, report }
}

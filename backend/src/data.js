import { randomBytes, scryptSync } from 'node:crypto'

import { venues } from './venues.js'

// Hobbiz se limita a Miraflores y Barranco. Centro de cada distrito y caja aproximada de sus límites
// (se usa para validar que el pin de un taller quede dentro del distrito declarado).
export const districts = {
  'Miraflores': [-12.1211, -77.0297],
  'Barranco': [-12.1494, -77.0208],
}
// Límites simplificados de cada distrito como polígonos [lat, lon] (aprox., trazados sobre OpenStreetMap):
// costa al oeste, Vía Expresa/Surquillo al este de Miraflores, Surco al este y Chorrillos al sur de Barranco.
export const districtAreas = {
  'Miraflores': [[-12.1085,-77.0545],[-12.1040,-77.0450],[-12.1030,-77.0300],[-12.1135,-77.0255],[-12.1260,-77.0235],[-12.1265,-77.0130],[-12.1340,-77.0120],[-12.1365,-77.0200],[-12.1350,-77.0250],[-12.1345,-77.0290],[-12.1270,-77.0390],[-12.1170,-77.0475]],
  'Barranco': [[-12.1345,-77.0290],[-12.1350,-77.0250],[-12.1365,-77.0200],[-12.1370,-77.0135],[-12.1500,-77.0140],[-12.1585,-77.0175],[-12.1610,-77.0240],[-12.1560,-77.0270],[-12.1450,-77.0275]],
}
// Punto dentro de polígono (ray casting). Suficiente para la escala de un distrito.
export function insideArea(district, lat, lon) {
  const poly = Object.hasOwn(districtAreas, district) ? districtAreas[district] : null
  if (!poly || !Number.isFinite(lat) || !Number.isFinite(lon)) return false
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i], [yj, xj] = poly[j]
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
export const isDistrict = (d) => typeof d === 'string' && Object.hasOwn(districts, d)
// Bounding boxes derivadas (para encuadrar mapas en el frontend).
export const districtBounds = Object.fromEntries(Object.entries(districtAreas).map(([d, p]) => [d, { north: Math.max(...p.map(x => x[0])), south: Math.min(...p.map(x => x[0])), west: Math.min(...p.map(x => x[1])), east: Math.max(...p.map(x => x[1])) }]))

export const categories = ['Arte', 'Cerámica', 'Música', 'Escritura', 'Artes escénicas', 'Cocina', 'Oficios', 'Bienestar', 'Otros']
export const imageNames = ['ceramica.jpg', 'pintura.jpg', 'cocina.jpg', 'arte.jpg', 'fotografia.jpg', 'flores.jpg', 'musica.svg', 'teatro.svg', 'escritura.svg', 'danza.svg', 'oficios.svg', 'bienestar.svg']
export const accents = ['terracota', 'oliva', 'azul', 'ciruela', 'noche']
export const fonts = ['moderna', 'clasica', 'redondeada', 'manuscrita']
export const layouts = ['portada', 'compacta', 'galeria']

export function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`
}

const defaultStudio = (over = {}) => ({ displayName: '', tagline: '', bio: '', link: '', links: {}, accent: 'terracota', accentColor: '', font: 'moderna', layout: 'portada', coverImage: '', gallery: [], district: '', address: '', ...over })

// Perfiles de los talleres reales investigados. No tienen contraseña: son fichas "por reclamar"
// hasta que el tallerista cree su cuenta (ver docs/BASE_DE_DATOS.md, flujo de reclamo).
// Textos públicos: se quitan las notas internas de verificación de la investigación (quedan en docs/TALLERES_FUENTES.md).
const internal = /(no se (encontr|hall|pudo|confirm)|fuera de instagram|sin confirmar|por confirmar|seg[uú]n |verificar|parece |posiblemente)/i
function publicText(text) {
  return String(text).replace(/\s*\([^)]*\)/g, m => internal.test(m) ? '' : m)
    .split(/(?<=\.)\s+/).filter(sentence => !internal.test(sentence)).join(' ').trim()
}
function clip(text, max) {
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  const words = cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:]$/, '').split(' ')
  while (/^(en|de|del|y|con|para|a|al|la|el|los|las|por|o)$/i.test(words.at(-1))) words.pop()
  return words.join(' ').replace(/[,;:]$/, '') + '…'
}
// Las fechas de ejemplo se desplazan para que siempre queden en el futuro aunque la demo se use meses después.
const SEED_REFERENCE = Date.parse('2026-10-29T12:00:00Z')
function upcoming(date) {
  const shift = Math.max(0, Math.ceil((Date.now() - SEED_REFERENCE) / 86400000))
  const weeks = Math.ceil(shift / 7) * 7
  const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + weeks)
  return d.toISOString().slice(0, 10)
}

function venueSeed() {
  const users = [], workshops = []
  for (const v of venues) {
    const id = `venue-${v.handle.replace(/[^a-z0-9]+/gi, '-')}`
    users.push({ id, name: v.venue, email: '', role: 'instructor', claimed: false, preferences: { interests: [], budget: 0, district: v.district, day: '' }, favorites: [],
      studio: defaultStudio({ displayName: v.venue, tagline: clip(publicText(v.activities).split(/[;.]/)[0], 140), bio: publicText(v.description), link: v.links.web || '', links: v.links, accent: v.accent, font: v.font, coverImage: v.image, gallery: [v.image], district: v.district, address: v.address }) })
    workshops.push({ id: `w-${v.handle.replace(/[^a-z0-9]+/gi, '-')}`, instructorId: id, published: true, enrollmentOpen: true, currency: 'PEN', sampleData: true,
      title: v.title, category: v.category, summary: clip(publicText(v.activities), 180), description: `${publicText(v.description)} Sesión de ejemplo publicada para el prototipo: confirma precio, fecha y cupos con el taller.`,
      price: v.price, district: v.district, venue: v.venue, address: v.address, lat: v.lat, lon: v.lon, locationPrecision: v.coordsConfidence,
      date: upcoming(v.date), startsAt: v.startsAt, endsAt: v.endsAt, capacity: v.capacity, level: v.level, image: v.image, materialsIncluded: v.materialsIncluded, materialsBring: v.materialsBring })
  }
  return { users, workshops }
}

export function createSeedStore() {
  const venue = venueSeed()
  const users = [
    { id: 'cliente-1', name: 'Alexis Castro', email: 'cliente@hobbiz.pe', role: 'client', passwordHash: hashPassword('Demo12345!'), preferences: { interests: ['Arte', 'Cerámica'], budget: 80, district: 'Miraflores', day: 'sábado' }, favorites: ['t-1'] },
    { id: 'tallerista-1', name: 'María Torres', email: 'tallerista@hobbiz.pe', role: 'instructor', claimed: true, passwordHash: hashPassword('Demo12345!'), preferences: { interests: [], budget: 0, district: 'Miraflores', day: '' }, favorites: [],
      studio: defaultStudio({ displayName: 'Estudio Demo Hobbiz', tagline: 'Cuenta de demostración para probar el modo tallerista', bio: 'Perfil ficticio usado para demostrar la gestión de talleres en el prototipo.', accent: 'terracota', coverImage: '/images/ceramica.jpg', district: 'Miraflores' }) },
    ...venue.users,
  ]
  const base = { published: true, enrollmentOpen: true, currency: 'PEN', instructorId: 'tallerista-1', venue: 'Estudio Demo Hobbiz', sampleData: true }
  const workshops = [
    { ...base, id: 't-1', title: 'Cerámica inicial (demo)', category: 'Cerámica', summary: 'Crea una pieza propia desde cero y descubre el modelado a mano.', description: 'Taller de demostración: técnicas básicas de modelado con arcilla, texturas y acabados en grupos pequeños.', price: 45, district: 'Miraflores', address: 'Calle Berlín 320, Miraflores', lat: -12.1223, lon: -77.0282, date: upcoming('2026-11-07'), startsAt: '16:00', endsAt: '18:00', capacity: 8, image: '/images/ceramica.jpg', level: 'Principiante', materialsIncluded: 'Arcilla, herramientas, horneado y esmaltes básicos', materialsBring: 'Mandil o ropa que pueda ensuciarse' },
    { ...base, id: 't-2', title: 'Pintura al óleo (demo)', category: 'Arte', summary: 'Explora el color y la luz en una sesión guiada.', description: 'Taller de demostración: bases de la pintura al óleo y una composición sobre lienzo.', price: 55, district: 'Barranco', address: 'Av. San Martín 212, Barranco', lat: -12.1461, lon: -77.0219, date: upcoming('2026-11-07'), startsAt: '11:00', endsAt: '13:30', capacity: 10, image: '/images/pintura.jpg', level: 'Principiante', materialsIncluded: 'Pinceles, lienzo, pintura y paleta', materialsBring: 'Mandil opcional' },
    { ...base, id: 't-3', title: 'Acuarela al atardecer (demo)', category: 'Arte', summary: 'Pinta paisajes del malecón con acuarela.', description: 'Taller de demostración: transparencias, mezclas de color y una pieza final.', price: 40, district: 'Miraflores', address: 'Malecón Cisneros, Miraflores', lat: -12.1268, lon: -77.0365, date: upcoming('2026-11-15'), startsAt: '16:00', endsAt: '18:00', capacity: 12, image: '/images/flores.jpg', level: 'Principiante', materialsIncluded: 'Pinturas, papeles, pinceles', materialsBring: 'Mandil opcional' },
    ...venue.workshops,
  ]
  const bookings = [
    { id: 'r-1', userId: 'cliente-1', workshopId: 'w-mundodebarro', seats: 2, status: 'confirmada', createdAt: '2026-10-10T12:00:00Z' },
    { id: 'r-2', userId: 'cliente-1', workshopId: 't-1', seats: 1, status: 'confirmada', createdAt: '2026-10-11T12:00:00Z' },
    ...Array.from({ length: 5 }, (_, i) => ({ id: `seed-${i}`, userId: `invitado-${i}`, workshopId: 't-1', seats: 1, status: 'confirmada', createdAt: '2026-10-11T13:00:00Z' })),
    ...Array.from({ length: 6 }, (_, i) => ({ id: `sample-${i}`, userId: `alumno-${i}`, workshopId: 't-2', seats: 1, status: 'confirmada', createdAt: '2026-10-12T13:00:00Z' })),
    ...Array.from({ length: 3 }, (_, i) => ({ id: `test-${i}`, userId: `participante-${i}`, workshopId: 't-3', seats: 1, status: 'confirmada', createdAt: '2026-10-13T13:00:00Z' })),
  ]
  // Reseñas de ejemplo solo en talleres de la cuenta demo (no se atribuyen opiniones a negocios reales).
  const reviews = [
    { id: 'v-1', workshopId: 't-1', userId: 'cliente-1', name: 'Alexis C.', stars: 5, comment: 'Me gustó el ambiente y la explicación de las técnicas.', createdAt: '2026-10-02T12:00:00Z' },
    { id: 'v-2', workshopId: 't-1', userId: 'u-2', name: 'Lucía P.', stars: 5, comment: 'Muy buena experiencia, incluye todos los materiales.', createdAt: '2026-10-01T12:00:00Z' },
    { id: 'v-3', workshopId: 't-2', userId: 'u-3', name: 'Andrea M.', stars: 4, comment: 'Buen taller, aprendí bastante de la técnica.', createdAt: '2026-10-05T12:00:00Z' },
    { id: 'v-5', workshopId: 't-3', userId: 'u-4', name: 'Mariela F.', stars: 5, comment: 'Perfecto para comenzar a pintar.', createdAt: '2026-10-08T12:00:00Z' },
  ]
  for (const b of bookings) { const price = workshops.find(w => w.id === b.workshopId)?.price || 0; Object.assign(b, { unitPrice: price, amount: price * b.seats }) }
  return { users, workshops, bookings, reviews, feedback: [], sessions: new Map() }
}

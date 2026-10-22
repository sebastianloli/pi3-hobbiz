import { randomBytes, scryptSync } from 'node:crypto'

export const districts = {
  'Miraflores': [-12.1211, -77.0297],
  'Barranco': [-12.1494, -77.0208],
  'San Isidro': [-12.0972, -77.0356],
  'Pueblo Libre': [-12.0773, -77.0635],
  'Santiago de Surco': [-12.1392, -76.9916],
  'Jesús María': [-12.0739, -77.0465],
  'Magdalena del Mar': [-12.0915, -77.0694],
  'San Miguel': [-12.0776, -77.0939]
}

export const categories = ['Arte', 'Cocina', 'Oficios', 'Bienestar', 'Otros']
export const imageNames = ['ceramica.jpg', 'pintura.jpg', 'cocina.jpg', 'arte.jpg', 'fotografia.jpg', 'flores.jpg']

export function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`
}

export function createSeedStore() {
  const users = [
    { id: 'cliente-1', name: 'Alexis Castro', email: 'cliente@hobbiz.pe', role: 'client', passwordHash: hashPassword('Demo12345!'), preferences: { interests: ['Arte', 'Cocina'], budget: 80, district: 'Miraflores', day: 'sábado' }, favorites: ['t-1'] },
    { id: 'tallerista-1', name: 'María Torres', email: 'tallerista@hobbiz.pe', role: 'instructor', passwordHash: hashPassword('Demo12345!'), preferences: { interests: [], budget: 0, district: 'Miraflores', day: '' }, favorites: [] },
  ]
  const base = { level: 'Principiante', published: true, materialsIncluded: 'Todos los materiales básicos', materialsBring: 'Ropa cómoda', currency: 'PEN' }
  const workshops = [
    { ...base, id: 't-1', title: 'Taller de cerámica', category: 'Arte', summary: 'Crea una pieza propia desde cero y descubre el modelado a mano.', description: 'Aprende técnicas básicas de modelado con arcilla, texturas y acabados. Acompañamiento cercano en grupos pequeños, no requiere experiencia previa.', price: 45, district: 'Miraflores', venue: 'Studio Barro Vivo', address: 'Calle Berlín 320, Miraflores', date: '2026-11-07', startsAt: '16:00', endsAt: '18:00', capacity: 8, instructorId: 'tallerista-1', image: '/images/ceramica.jpg', materialsIncluded: 'Arcilla, herramientas, horneado y esmaltes básicos', materialsBring: 'Mandil o ropa que pueda ensuciarse', level: 'Principiante' },
    { ...base, id: 't-2', title: 'Pintura al óleo', category: 'Arte', summary: 'Explora el color y la luz en una sesión guiada.', description: 'Conoce las bases de la pintura al óleo y crea una composición sobre lienzo. Todos los materiales están preparados para principiantes.', price: 55, district: 'Barranco', venue: 'Atelier Barranco', address: 'Av. San Martín 212, Barranco', date: '2026-11-07', startsAt: '11:00', endsAt: '13:30', capacity: 10, instructorId: 'tallerista-1', image: '/images/pintura.jpg', materialsIncluded: 'Pinceles, lienzo, pintura y paleta', materialsBring: 'Mandil opcional' },
    { ...base, id: 't-3', title: 'Cocina peruana', category: 'Cocina', summary: 'Prepara platos peruanos de la mano de una chef.', description: 'Taller vivencial donde prepararás un menú completo y aprenderás nuevas técnicas culinarias, ideal para compartir con amigos.', price: 75, district: 'San Isidro', venue: 'Cocina Abierta', address: 'Av. Los Conquistadores 440, San Isidro', date: '2026-11-08', startsAt: '15:00', endsAt: '18:00', capacity: 12, instructorId: 'otro-1', image: '/images/cocina.jpg', materialsIncluded: 'Ingredientes, recetas, utensilios y degustación', materialsBring: 'Cabello recogido' },
    { ...base, id: 't-4', title: 'Linograbado creativo', category: 'Arte', summary: 'Diseña, talla y estampa tu propio grabado.', description: 'Aprende las nociones de linograbado artesanal y llévate cinco estampas hechas por ti. Sesión práctica y personalizada.', price: 55, district: 'Pueblo Libre', venue: 'Estudio de Grabado', address: 'Av. Sucre 510, Pueblo Libre', date: '2026-11-14', startsAt: '15:00', endsAt: '18:00', capacity: 8, instructorId: 'otro-1', image: '/images/arte.jpg', materialsIncluded: 'Planchas, tintas, herramientas y papel', materialsBring: 'Mandil y ganas de experimentar' },
    { ...base, id: 't-5', title: 'Caminata fotográfica', category: 'Otros', summary: 'Aprende composición mientras exploras Barranco.', description: 'Una salida fotográfica para descubrir encuadres, luz y narrativa visual en las calles de Barranco.', price: 30, district: 'Barranco', venue: 'Plaza de Barranco', address: 'Parque Municipal de Barranco, Lima', date: '2026-11-14', startsAt: '15:00', endsAt: '17:00', capacity: 15, instructorId: 'otro-1', image: '/images/fotografia.jpg', materialsIncluded: 'Guía digital', materialsBring: 'Celular o cámara, agua y calzado cómodo' },
    { ...base, id: 't-6', title: 'Cocina italiana artesanal', category: 'Cocina', summary: 'Aprende pasta fresca desde la masa.', description: 'En un ambiente acogedor, amasa, corta y cocina tu propia pasta con ingredientes frescos.', price: 60, district: 'Miraflores', venue: 'Mesa Compartida', address: 'Calle Porta 165, Miraflores', date: '2026-11-14', startsAt: '18:00', endsAt: '20:30', capacity: 10, instructorId: 'otro-1', image: '/images/cocina.jpg', materialsIncluded: 'Ingredientes, delantal, recetas', materialsBring: 'Cabello recogido' },
    { ...base, id: 't-7', title: 'Arreglos florales', category: 'Oficios', summary: 'Diseña un ramo de flores de temporada.', description: 'Selecciona flores, aprende composición y construye un arreglo para llevar a casa.', price: 65, district: 'Santiago de Surco', venue: 'Flor de Estación', address: 'Av. Primavera 1120, Santiago de Surco', date: '2026-11-15', startsAt: '10:00', endsAt: '12:00', capacity: 9, instructorId: 'otro-1', image: '/images/flores.jpg', materialsIncluded: 'Flores, tijeras y base decorativa', materialsBring: 'Bolsa para trasladar el ramo' },
    { ...base, id: 't-8', title: 'Acuarela para principiantes', category: 'Arte', summary: 'Relájate pintando paisajes con acuarela.', description: 'Explora transparencias y mezclas de color mediante ejercicios sencillos y una pieza final.', price: 40, district: 'Jesús María', venue: 'Casa Taller', address: 'Av. Cuba 550, Jesús María', date: '2026-11-15', startsAt: '16:00', endsAt: '18:00', capacity: 12, instructorId: 'tallerista-1', image: '/images/pintura.jpg', materialsIncluded: 'Pinturas, papeles, pinceles', materialsBring: 'Mandil opcional' },
  ]
  const bookings = [
    { id: 'r-1', userId: 'cliente-1', workshopId: 't-3', seats: 2, status: 'confirmada', createdAt: '2026-10-10T12:00:00Z' },
    { id: 'r-2', userId: 'cliente-1', workshopId: 't-1', seats: 1, status: 'confirmada', createdAt: '2026-10-11T12:00:00Z' },
    ...Array.from({ length: 5 }, (_, i) => ({ id: `seed-${i}`, userId: `invitado-${i}`, workshopId: 't-1', seats: 1, status: 'confirmada', createdAt: '2026-10-11T13:00:00Z' })),
    ...Array.from({ length: 6 }, (_, i) => ({ id: `sample-${i}`, userId: `alumno-${i}`, workshopId: 't-2', seats: 1, status: 'confirmada', createdAt: '2026-10-12T13:00:00Z' })),
    ...Array.from({ length: 3 }, (_, i) => ({ id: `test-${i}`, userId: `participante-${i}`, workshopId: 't-8', seats: 1, status: 'confirmada', createdAt: '2026-10-13T13:00:00Z' }))
  ]
  const reviews = [
    { id: 'v-1', workshopId: 't-1', userId: 'cliente-1', name: 'Alexis C.', stars: 5, comment: 'Me gustó el ambiente y la explicación de las técnicas.', createdAt: '2026-10-02T12:00:00Z' },
    { id: 'v-2', workshopId: 't-1', userId: 'u-2', name: 'Lucía P.', stars: 5, comment: 'Muy buena experiencia, incluye todos los materiales.', createdAt: '2026-10-01T12:00:00Z' },
    { id: 'v-3', workshopId: 't-2', userId: 'u-3', name: 'Andrea M.', stars: 4, comment: 'Buen taller, aprendí bastante de la técnica.', createdAt: '2026-10-05T12:00:00Z' },
    { id: 'v-4', workshopId: 't-3', userId: 'cliente-1', name: 'Alexis C.', stars: 5, comment: 'Una experiencia excelente y muy entretenida.', createdAt: '2026-10-11T12:00:00Z' },
    { id: 'v-5', workshopId: 't-8', userId: 'u-4', name: 'Mariela F.', stars: 5, comment: 'Perfecto para comenzar a pintar.', createdAt: '2026-10-08T12:00:00Z' }
  ]
  return { users, workshops, bookings, reviews, sessions: new Map() }
}

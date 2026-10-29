# Base de datos de Hobbiz: usuarios, talleres y cuentas de talleristas

Este documento explica cómo se guardan los datos de Hobbiz y cómo pasar del modo `demo` (memoria) al modo conectado `firebase-mongo`. Sigue el **Concepto C** elegido en la ficha técnica: **Firebase Authentication** para identidad y **MongoDB Atlas** para los datos.

## 1. Quién guarda qué

| Dato | Dónde vive | Por qué |
|---|---|---|
| Correo y contraseña, sesión, "Recordarme", recuperación de contraseña | **Firebase Authentication** | Nunca guardamos contraseñas en MongoDB. Firebase entrega un *ID token* firmado que el backend verifica. |
| Perfil (nombre, rol, preferencias, guardados, personalización del tallerista) | MongoDB, colección `users` | El `id` del documento es el **UID de Firebase**: la misma persona en todos los endpoints. |
| Talleres | MongoDB, `workshops` | Documentos flexibles: cada categoría puede tener campos distintos. |
| Reservas | MongoDB, `bookings` | Una fila por reserva, con estado. |
| Reseñas | MongoDB, `reviews` | Una por usuario y taller (índice único). |
| Formulario de opinión | MongoDB, `feedback` | Para validar el prototipo (exigencia E2). |

El navegador **nunca** habla directamente con MongoDB. Solo habla con la API Express, y la API verifica el token Firebase en cada petición (`backend/src/app.js` → `requireAuth`).

```
Navegador (Vue) ──login──► Firebase Auth ──ID token──┐
      │                                               │
      └──── /api/* + Authorization: Bearer <token> ──►  Express ──verifyIdToken──► Firebase Admin
                                                         │
                                                         └──► MongoDB Atlas (users, workshops, bookings, reviews, feedback)
```

## 2. Colecciones y forma de los documentos

### `users`: clientes y talleristas en la misma colección

```js
{
  id: "<uid de Firebase>",          // índice único
  name: "María Torres",
  email: "maria@correo.pe",          // índice único (si no está vacío)
  role: "client" | "instructor",
  claimed: true,                     // false = ficha de taller real aún no reclamada (sin cuenta)
  preferences: { interests: ["Cerámica"], budget: 80, district: "Miraflores", day: "sábado" },
  favorites: ["w-mundodebarro", "t-1"],   // ids de talleres guardados (exigencia E3)
  studio: {                          // solo talleristas (exigencia E5)
    displayName, tagline, bio,
    accent: "terracota|oliva|azul|ciruela|noche", accentColor: "#rrggbb",
    font: "moderna|clasica|redondeada|manuscrita", layout: "portada|compacta|galeria",
    coverImage, gallery: [ ... hasta 6 ],
    links: { web, instagram, facebook, tiktok, whatsapp },  // todos HTTPS
    district: "Miraflores|Barranco", address
  }
}
```

**¿Por qué una sola colección y no `clientes` y `talleristas` por separado?** Una persona tiene un único login, y el rol decide qué rutas puede abrir. Así se evita duplicar correos y sesiones.

### `workshops`

```js
{
  id, instructorId,                  // dueño = users.id del tallerista
  title, summary, description, category, level,
  price, currency: "PEN", capacity,
  district: "Miraflores" | "Barranco",
  venue, address,
  lat, lon,                          // pin marcado en el mapa; se valida dentro del distrito
  locationPrecision: "direccion" | "aproximada" | "distrito",
  date: "2026-11-14", startsAt: "15:00", endsAt: "17:30",
  recurrence: "once" | "weekly", recurrenceGroupId, repeatCount,
  enrollmentOpen: true,              // el tallerista abre o cierra cupos (E6)
  published: true,
  materialsIncluded, materialsBring, image,
  sampleData: true                   // datos de ejemplo del prototipo
}
```

Los cupos disponibles **no se guardan**. Se calculan como `capacity − Σ bookings.seats confirmadas`, así nunca se desincronizan.

### `bookings` y `reviews`

```js
bookings: { id, userId, workshopId, seats, status: "confirmada", createdAt }
reviews:  { id, userId, workshopId, name, stars: 1..5, comment, createdAt }  // único por (workshopId, userId)
```

### Índices que crea `backend/src/db.js` al arrancar

- `id` único en todas las colecciones.
- `workshops {published, district, category, date}` para el catálogo y los filtros.
- `workshops {instructorId}` para el panel del tallerista.
- `bookings {workshopId, status}` y `bookings {userId}`.
- `reviews {workshopId, userId}` único: una reseña por persona y taller.
- `users {email}` único parcial (las fichas sin cuenta tienen correo vacío).

## 3. Cuentas de talleristas

### Registro normal
1. En **Mi cuenta → Crear una cuenta** se elige "Tallerista".
2. Firebase crea el usuario y el frontend llama `POST /api/account {name, role:"instructor"}`.
3. El backend verifica el token y crea `users/{uid}` con `role:"instructor"`.
4. Con esa sesión ya puede personalizar su perfil y publicar talleres. Cada taller queda con `instructorId = uid`, y la API solo deja editarlo a su dueño (responde 404 si no le pertenece).

### Fichas de talleres reales "por reclamar"
Los 24 talleres reales de `talleres.pdf` se cargan como usuarios `role:"instructor"` con `claimed:false`, **sin correo ni contraseña**. Nadie puede iniciar sesión con ellos. Cuando el negocio real quiera administrar su ficha:

1. Crea su cuenta normal de tallerista.
2. Solicita el reclamo (para el prototipo, por correo o formulario al equipo; la verificación de identidad está **fuera del alcance**).
3. El equipo ejecuta una actualización en MongoDB que traslada los talleres y la personalización:
   ```js
   db.workshops.updateMany({ instructorId: "venue-mundodebarro" }, { $set: { instructorId: "<uid nuevo>" } })
   const ficha = db.users.findOne({ id: "venue-mundodebarro" })
   db.users.updateOne({ id: "<uid nuevo>" }, { $set: { studio: ficha.studio, claimed: true } })
   db.users.deleteOne({ id: "venue-mundodebarro" })
   ```

### Rol en Firebase (opcional, recomendado)
Hoy el rol vive en MongoDB. Si se quiere que también viaje dentro del token, se puede asignar un *custom claim* con el Admin SDK: `admin.auth().setCustomUserClaims(uid, { role: 'instructor' })`. Esto evita una lectura a la base de datos por petición.

## 4. Inicio de sesión obligatorio y "Recordarme"

- **Frontend:** `frontend/src/router.js` redirige a `/cuenta?redirect=…` cualquier ruta cuando no hay sesión. Las rutas de cliente y de tallerista además exigen el rol correspondiente.
- **Backend:** todos los endpoints de datos (`/api/workshops`, `/api/instructors/:id`, reseñas, recomendaciones, etc.) exigen `Authorization: Bearer`. Solo `/api/health`, `/api/meta` y los de login y registro son públicos.
- **Recordarme, modo Firebase:** antes de iniciar sesión se llama `setPersistence(auth, browserLocalPersistence)` si la casilla está marcada; si no, `browserSessionPersistence`, que se borra al cerrar la pestaña. Firebase renueva solo el ID token, que dura 1 hora.
- **Recordarme, modo demo:** el backend emite tokens de **30 días** si se marca la casilla y de **8 horas** si no. El frontend guarda el token en `localStorage` o en `sessionStorage` según el caso. Además recuerda el último correo usado.

## 5. Conectar su proyecto real (Firebase `hobbiz-597c5` + Atlas `hobbiz-demo`)

> **Seguridad primero.** Si la clave privada de la cuenta de servicio se compartió por chat o en capturas, **revócala**: *Firebase Console → Configuración del proyecto → Cuentas de servicio → Administrar permisos (Google Cloud) → Claves → eliminar*, y genera una nueva. Nunca la subas a Git.

1. **Firebase → Authentication → Método de acceso:** habilita *Correo electrónico/contraseña*.
2. **Firebase → Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada.** Guarda el JSON en `backend/credentials/`. La carpeta está ignorada por Git; no hace falta tocar `GOOGLE_APPLICATION_CREDENTIALS`.
3. **Atlas → Database & Network Access:**
   - Crea un usuario de BD con rol *readWrite* sobre `hobbiz`.
   - Agrega tu IP. Para una demostración en otra red puedes añadir temporalmente `0.0.0.0/0` y quitarlo después.
4. **Atlas → hobbiz-demo → Connect → Drivers:** copia la cadena `mongodb+srv://…`.
5. Crea `backend/.env` a partir de `backend/.env.example`:
   ```
   HOBBIZ_MODE=firebase-mongo
   MONGODB_URI=mongodb+srv://USUARIO:<db_password>@hobbiz-demo.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=hobbiz-demo
   MONGODB_PASSWORD=la-contraseña-del-usuario-de-BD
   MONGODB_DB=hobbiz
   MONGODB_SEED_CATALOG=true
   FIREBASE_PROJECT_ID=hobbiz-597c5
   ```
6. `frontend/.env`: copia `frontend/.env.example`. Ya trae la configuración pública de `hobbiz-597c5`. Agrega `VITE_GOOGLE_MAPS_EMBED_KEY` solo si quieren el mapa de Google en la ficha.
7. Ejecuta `npm run db:check`. Debe mostrar ✔ en Atlas y en Firebase, y listar la migración que se aplicará: talleres del MVP anterior que se ocultan, coordenadas y montos que se completan.
8. Ejecuta `npm run dev`. En la consola del backend aparece `[mongo] Migración aplicada: {...}` la primera vez.
9. **Usuarios que ya existen en Firebase** (los 3 de la consola) todavía no tienen perfil en MongoDB. Cada uno debe entrar por **Mi cuenta → Crear una cuenta** con el **mismo correo y contraseña** y elegir su rol. La app detecta que la cuenta ya existe en Firebase, inicia sesión y crea solo el perfil.
10. Prueba de persistencia: reserva, guarda un taller, deja una reseña, reinicia `npm run dev` y comprueba que todo sigue ahí. También puedes verlo en *Atlas → Browse collections*.

## 6. Mejoras recomendadas antes de un despliegue real

- **Reservas atómicas:** hoy hay una cola global de escrituras por proceso (de la rama de Santiago) que evita la sobreventa en una sola instancia, y las series se guardan en una transacción. Con varias instancias, se reemplaza por una transacción o por un contador `reserved` en el taller con `findOneAndUpdate({ id, $expr: { $lte: [{ $add: ['$reserved', seats] }, '$capacity'] } }, { $inc: { reserved: seats } })`.
- **Búsqueda geográfica en la BD:** guardar además `location: { type: 'Point', coordinates: [lon, lat] }` con un índice `2dsphere`, y usar `$geoNear` para "Cerca de mí". Hoy la distancia se calcula en Node, lo cual basta para cientos de talleres.
- **Imágenes:** pasar de Base64 dentro del documento a Firebase Storage o Cloudinary, y guardar solo la URL.
- **Alternativa SQL:** si el docente prefiere SQL, el mismo modelo se traduce a tablas `users`, `workshops`, `bookings` y `reviews` con llaves foráneas (`workshops.instructor_id → users.id`, etc.) en Supabase o PostgreSQL.

# Integración de la rama `avance-santiago-semana11`

La rama tiene un solo commit (*"Completa horarios, reseñas, ubicación y guardado del prototipo"*) sobre la misma base que `main` (`bc0c70b`). Cambia 6 archivos: `backend/src/app.js`, `db.js`, `index.js` y las vistas `Explore`, `InstructorEditor` y `WorkshopDetail`.

## Qué se incorporó

| Aporte de Santiago | Cómo quedó integrado |
|---|---|
| **Guardar primero en MongoDB y después cambiar la memoria** (en `PATCH /me`, guardados, reseñas, edición de talleres y perfil) | Se aplicó a todas las escrituras. Si Atlas falla, la app responde 500 y los datos en memoria no cambian. Lo cubre `test/mongo.test.js`. |
| **`persistMany` con transacción** para las series semanales | Está en `db.js`: las N sesiones se guardan en una sola transacción, todo o nada. Si el Mongo local no tiene replica set, hay un respaldo que deshace lo insertado. Atlas, incluso el plan M0 gratuito, sí admite transacciones. |
| **Cola global de escrituras** (`mutationTail`) | Reemplaza la cola que solo cubría reservas. Ahora todas las peticiones que modifican datos se atienden de una en una, y se libera con `res.on('close')`, sin reescribir `res.end`. La prueba con 3 reservas simultáneas sobre el último cupo da 201, 409, 409. |
| **Filtro de hora "empieza desde / termina hasta"** | Se añadió en Explorar y en la API (`startsAfter`, `endsBefore`), con validación de formato y de orden. Convive con el filtro por franja (mañana, tarde o noche). |
| **Coordenadas del local copiadas de Google Maps** | En el editor, además de marcar el pin en el mapa, se puede pegar `-12.1211, -77.0297`. La API acepta también los nombres `latitude`/`longitude` de su rama y los convierte a `lat`/`lon`. |
| **Mapa de Google en la ficha** (`VITE_GOOGLE_MAPS_EMBED_KEY`) | Es opcional. Si la clave está en `frontend/.env`, la ficha muestra Google Maps Embed (sin costo); si no, usa Leaflet y OpenStreetMap. |
| **Validación de fechas reales y de límites del nombre** | Ya estaba en nuestra versión con la misma regla (por ejemplo, rechaza `2027-02-31`). |
| **Manejo de errores con `try/catch → next(err)`** | Express 5 ya pasa al manejador de errores los rechazos de las funciones `async`; el efecto es el mismo. |

## Qué no se tomó y por qué

- **Latitud y longitud opcionales, con el centro del distrito como reemplazo.** La plataforma exige ahora el pin dentro del polígono de Miraflores o Barranco. Para datos antiguos sin coordenadas, la migración asigna el centro del distrito y marca la ubicación como "aproximada".
- **El bloque del mapa de Google en `WorkshopDetail.vue` tenía `<section>` anidadas sin cerrar.** Al integrarlo se reescribió con un HTML válido.
- **La personalización del perfil de su rama** (3 colores, biografía, enlace) es un subconjunto de la actual. Se conservó la validación de tipos que agregó, como `coverImage` de tipo texto.

## Base de datos: qué se mejoró para la implementación real

1. **Migración automática e idempotente** (`backend/src/migrate.js`) al arrancar en modo `firebase-mongo`, pensada para la base que ya existe en Atlas (`hobbiz-demo`):
   - Los talleres de distritos que ya no corresponden (San Isidro, Pueblo Libre, etc.) se **ocultan, no se borran**, porque pueden tener reservas. Quedan con `archivedReason: 'fuera-de-zona'`.
   - Los talleres de la semilla antigua sin dueño real (`otro-1`, `tallerista-1`) se ocultan con `archivedReason: 'sin-tallerista'`.
   - `latitude`/`longitude` pasan a `lat`/`lon`. Si faltan o caen fuera del distrito, se usa el centro del distrito.
   - Las reservas antiguas reciben `unitPrice` y `amount`.
   - Las preferencias con distritos antiguos pasan a Miraflores, y los colores de perfil que no son válidos pasan a terracota.
   - Con `MONGODB_SEED_CATALOG=true` se **insertan solo** las fichas reales que falten (`$setOnInsert`), sin pisar las que ya se editaron.
2. **Los índices ya no impiden el arranque.** Si uno no se puede crear, por ejemplo por reseñas duplicadas de una versión anterior, se muestra un aviso y la app sigue.
3. **Firebase Admin** busca la cuenta de servicio en `backend/credentials/*.json` (carpeta ignorada por Git), así que ya no hace falta escribir rutas de Windows en `.env`.
4. **`npm run db:check`** revisa `.env`, la conexión a Atlas, el conteo por colección, la migración pendiente (simulada, sin escribir) y la credencial de Firebase.
5. **Pruebas** (`backend/test/mongo.test.js`) con un cliente Mongo simulado:
   - Prueban la migración sobre datos con la forma del MVP anterior y de su rama.
   - Prueban reservas concurrentes, la transacción de la serie y su rollback.
   - Comprueban que la memoria no cambie si Atlas falla y que los datos persistan al reabrir.

Ver [`BASE_DE_DATOS.md`](BASE_DE_DATOS.md) para el paso a paso de la conexión con `hobbiz-597c5` y `hobbiz-demo`.

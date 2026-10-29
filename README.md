# Hobbiz — MVP integrado (cliente + tallerista)

Prototipo universitario para conectar a personas que buscan talleres recreativos en **Miraflores y Barranco** (Lima) con pequeños talleristas. Desarrollo sobre el MVP de `main`, incorporando la propuesta de `rama_santiago` (**MongoDB Atlas + Firebase Authentication**) y unificando el flujo de cliente y tallerista. Este ZIP es una **entrega de integración**, no un cambio aplicado al repositorio GitHub.

**Stack:** Vue 3, Vue Router, Vite, Leaflet + OpenStreetMap (mapa gratuito, sin API key), Node.js, Express 5, Firebase Auth (opcional), MongoDB Atlas (opcional). El catálogo incluye 24 talleres reales de Miraflores y Barranco ([fuentes](docs/TALLERES_FUENTES.md)), con sesiones de ejemplo, y 3 talleres de la cuenta demo.

## 1. Ejecutar de inmediato en VS Code (sin credenciales externas)

Requisitos: Node.js >= 20.19 y npm. Abre en VS Code la carpeta que contiene `package.json`.

```powershell
npm install
npm run dev
```

- Frontend: http://localhost:5173
- API: http://127.0.0.1:3001/api/health
- `npm run dev` inicia frontend y backend simultáneamente.
- Modo predeterminado `demo`: datos temporales en memoria. Se reinician al cerrar el backend.
- **Hay que iniciar sesión para usar la plataforma.** En la pantalla de ingreso hay botones que rellenan las cuentas demo: `cliente@hobbiz.pe` / `Demo12345!` y `tallerista@hobbiz.pe` / `Demo12345!`.
- Marca **Recordarme** para mantener la sesión hasta 30 días; sin marcarla, se cierra al cerrar la pestaña.
- Si se ejecuta en una red pública, **no expongas el modo demo**: es deliberadamente inseguro y solo para pruebas locales.

## 2. Activar implementación de Santiago: Firebase + MongoDB

La integración ahora utiliza **un solo sistema de identidad por modo**. En `firebase-mongo` el ID del token Firebase, verificado en backend, es el ID de usuario para reservas, guardados, publicaciones y reseñas; MongoDB almacena perfiles, talleres, reservas, reseñas, comentarios de validación y fotos en documentos.

1. Copia `backend/.env.example` como `backend/.env`.
2. Cambia `HOBBIZ_MODE=firebase-mongo` y configura `MONGODB_URI`, `MONGODB_DB`, `MONGODB_PASSWORD` (si la URL utiliza `<db_password>`), `FIREBASE_PROJECT_ID`.
3. Para Firebase Admin SDK, configura `GOOGLE_APPLICATION_CREDENTIALS` con una **cuenta de servicio privada guardada fuera del repositorio**. No se distribuyen credenciales privadas. Obtén las credenciales desde un proyecto autorizado de Firebase.
4. Copia `frontend/.env.example` como `frontend/.env`. Incluye los parámetros públicos del proyecto Firebase que figuraba en `rama_santiago`. Comprueba que el proyecto Firebase esté activo y que el método correo/contraseña esté habilitado en Authentication.
5. Autoriza la IP de desarrollo en MongoDB Atlas; crea usuario de BD con privilegios mínimos para desarrollo.
6. En `backend/.env`, `MONGODB_SEED_CATALOG=true` carga 8 talleres **ilustrativos** en una BD vacía. No crea cuentas Firebase demo. Para iniciar con catálogo vacío, usa `false`.
7. Desde la raíz ejecuta `npm install` y `npm run dev`. En Hobbiz usa **Mi cuenta** para crear usuario/tallerista real. Las nuevas publicaciones serán propiedad del UID de Firebase.

**Importante:** El modo `firebase-mongo` necesita MongoDB conectado para arrancar y credenciales válidas para verificar tokens. Si quieres seguir desarrollando sin estas configuraciones usa el modo `demo`. No existe mezcla entre tokens demo y Firebase.

## 3. Funciones actuales

### Acceso
- Inicio de sesión **obligatorio**: todas las rutas, salvo `/cuenta`, y todos los endpoints de datos exigen sesión.
- Clientes y talleristas solo ven las secciones de su rol.
- **Recordarme**: con la casilla, `localStorage` y token de 30 días (o `browserLocalPersistence` en Firebase); sin ella, `sessionStorage` y 8 horas. También recuerda el último correo usado.

### Cliente
- Catálogo de talleres de Miraflores y Barranco con nombre, categoría, local, dirección, precio, fecha y horario.
- **Búsqueda manual** (`/explorar`): texto, categoría, distrito, precio máximo, día y horario (mañana, tarde o noche). Vista de lista o de **mapa**.
- **Cerca de mí** (`/cerca`, apartado separado): GPS del navegador, toque en el mapa o centro del distrito; radio de 500 m a 5 km; distancias reales hasta el pin de cada taller.
- Ficha con mapa de ubicación, enlace "Cómo llegar", materiales, nivel, cupos, reseñas y perfil del tallerista.
- Los talleres agotados se ocultan salvo búsqueda del **nombre exacto**, y entonces se indica que no hay cupos.
- Guardados con marcador, preferencias, reserva simulada con confirmación y reseñas de 1 a 5 con promedio automático.
- Formulario de opinión (`/opinion`): facilidad de uso, opinión sobre las nuevas funciones, qué fue confuso y recomendación o crítica. Las respuestas se guardan en la colección `feedback` de MongoDB (en modo demo, solo en memoria) y el equipo las revisa desde Atlas, por ejemplo exportándolas a CSV con Compass.

### Tallerista
- Panel con talleres activos, cupos, ocupación, **monto recaudado estimado por taller** y calificaciones.
- Crear, editar, ocultar o eliminar talleres; fecha única o serie semanal; **abrir o cerrar inscripciones**.
- Ubicación con **pin en el mapa**, validado dentro de Miraflores o Barranco, y búsqueda de dirección gratuita (Nominatim).
- Personalización del perfil: cuestionario de estética, colores (incluido un color propio), tipografía, distribución, portada, galería y enlaces (web, Instagram, Facebook, TikTok y WhatsApp). Página pública en `/estudio/:id`.
- Lista de inscritos, agenda y reseñas.

## 4. Comandos

```powershell
npm install                  # instala las dependencias y genera package-lock.json
npm run dev                 # levanta frontend + backend
npm run build               # compila frontend (Vite)
npm test                    # pruebas de API, roles, reservas, recurrencias
```

> Este paquete **no incluye `node_modules` ni `package-lock.json`**. El lockfile del MVP anterior no describe las dependencias de Santiago; `npm install` generará uno correcto. Confírmalo después en Git.

## 5. Seguridad y limitaciones explícitas

- **No hay pagos reales**, notificaciones push, chat, verificación documental de talleristas, IA, integración con redes sociales ni app móvil nativa.
- Las fotografías que se suben se almacenan como Base64 en el documento del taller; para producción se necesitará almacenamiento de objetos, redimensionamiento y análisis de archivos.
- El almacenamiento MongoDB mantiene una **copia en memoria por proceso** para responder al catálogo; está pensado para **una instancia única de Express**. La cola de reservas evita sobreventa dentro de ese único proceso, pero para múltiples réplicas hay que reemplazarla por transacciones/actualizaciones atómicas MongoDB, relecturas y mecanismos de consistencia. No es un backend listo para Internet/producción.
- El modo demo tiene acceso a cuentas fijas, por eso solo es adecuado para desarrollo local.
- Las recomendaciones son basadas en reglas de intereses, zona y precio; no usan aprendizaje automático.
- Mapa con Leaflet y teselas de OpenStreetMap: gratuito y sin clave, siempre que se cite OpenStreetMap. Para un uso intensivo conviene un proveedor de teselas propio (MapTiler o Stadia, con plan gratuito). Google Maps exige una cuenta con facturación y una API key; se puede cambiar en `MapView.vue`. 9 de los 24 talleres reales no tienen dirección pública: su pin es aproximado y así se indica en la ficha.
- Las sesiones recurrentes se generan como publicaciones independientes cada siete días; no existe todavía un editor masivo de series.
- El perfil configurable admite una biografía, nombre, portada, enlace HTTPS y tres temas predefinidos; no admite estilos personalizados arbitrarios por seguridad.
- Si quieres filtrar por horario exacto y no solo día de semana, deberás ampliar la API.

## 6. Requisitos, checklist y pruebas

- Requisitos y estado: [`docs/CHECKLIST_EPYC.md`](docs/CHECKLIST_EPYC.md).
- Base de datos, cuentas de talleristas y "Recordarme": [`docs/BASE_DE_DATOS.md`](docs/BASE_DE_DATOS.md).
- Talleres reales y fuentes: [`docs/TALLERES_FUENTES.md`](docs/TALLERES_FUENTES.md).
- Integración de la rama de Santiago: [`docs/INTEGRACION_SANTIAGO.md`](docs/INTEGRACION_SANTIAGO.md).
- Diagnóstico de la conexión real: `npm run db:check`.
- Pruebas manuales: [`docs/PRUEBAS_MANUALES.md`](docs/PRUEBAS_MANUALES.md).
- Los tests de Firebase usan un **verificador simulado de tokens** y un guardado simulado, no conexiones de pago/Atlas. La prueba de integración real de Firebase/Mongo debe ejecutarse con servicios autorizados.

## 7. Incorporarlo en Git sin perder `main`

El ZIP contiene los archivos del proyecto **sin carpeta `.git`**. En el repositorio ya existente:

```powershell
git switch main
git pull --ff-only origin main
git switch -c feature/integracion-santiago
# Copia los archivos de este ZIP SOBRE tu carpeta local del repositorio.
npm install
npm test
npm run build
git add .
git commit -m "Integra autenticacion, persistencia y mejoras del MVP"
git push -u origin feature/integracion-santiago
```

Revisa los cambios mediante Pull Request antes de llevarlos a `main`. **No intentes hacer merge directo de `rama_santiago` a `main`**: los commits actuales no comparten ancestro. No subas `backend/.env`, `frontend/.env` ni credenciales JSON.

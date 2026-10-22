# Hobbiz — MVP integrado (cliente + tallerista)

Prototipo universitario para conectar a personas que buscan talleres recreativos en Lima con pequeños talleristas. Desarrollo sobre el MVP de `main`, incorporando la propuesta de `rama_santiago` (**MongoDB Atlas + Firebase Authentication**) y unificando el flujo de cliente y tallerista. Este ZIP es una **entrega de integración**, no un cambio aplicado al repositorio GitHub.

**Stack:** Vue 3, Vue Router, Vite, Node.js, Express 5, Firebase Auth (opcional), MongoDB Atlas (opcional). Fotos y contenido del catálogo: ilustrativos.

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
- Cuentas demo: `cliente@hobbiz.pe` / `Demo12345!` y `tallerista@hobbiz.pe` / `Demo12345!`.
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

### Cliente
- Catálogo centralizado y búsqueda por palabra, categoría, distrito, presupuesto y día.
- "Cerca de mí": selecciona distrito de referencia o autoriza una ubicación GPS puntual; usa radio de 3 a 25 km. Distancia aproximada al centro de los distritos de los talleres (sin Google Maps). Las coordenadas del usuario no se almacenan.
- Talleres agotados se ocultan del catálogo salvo búsqueda del **nombre exacto**; se sigue viendo su ficha si se tiene el enlace.
- Ficha con descripción, fotos, local, dirección, nivel, materiales, precio, horario, cupos y reseñas.
- Perfil y preferencias, guardados, reservas simuladas y valoración 1-5 con comentario, después de una reserva.
- Agenda mensual de reservas y aviso **dentro de la web** cuando una sesión empieza en menos de 48h.
- Sugerencias por reglas simples en Inicio (sin IA).
- Formulario de opinión para validar el prototipo.

### Tallerista
- Panel de talleres activos, ocupación, cupos, ingresos **estimados, no cobrados**, calificaciones.
- Crear/editar/ocultar/publicar/eliminar un taller; validación de todos los campos obligatorios en frontend y backend.
- Duplicar talleres para otra fecha.
- Publicar serie **semanal** de hasta ocho sesiones independientes y controlar cupos por sesión.
- Ver inscritos, agenda y reseñas.
- Perfil público: nombre del estudio, biografía, foto de portada, enlace HTTPS y paleta visual predefinida.

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
- El mapa completo con puntos georreferenciados y Google Maps se considera etapa posterior. "Cerca de mí" permite GPS puntual del usuario, pero calcula la distancia a centroides de distritos de talleres.
- Las sesiones recurrentes se generan como publicaciones independientes cada siete días; no existe todavía un editor masivo de series.
- El perfil configurable admite una biografía, nombre, portada, enlace HTTPS y tres temas predefinidos; no admite estilos personalizados arbitrarios por seguridad.
- Si quieres filtrar por horario exacto y no solo día de semana, deberás ampliar la API.

## 6. Requisitos, checklist y pruebas

- Requisitos y estado: [`docs/CHECKLIST_EPYC.md`](docs/CHECKLIST_EPYC.md).
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

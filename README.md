# Hobbiz

Plataforma web para encontrar, comparar y reservar talleres recreativos en **Miraflores y Barranco** (Lima), y para que los talleristas publiquen y gestionen sus talleres. Proyecto del curso Proyectos Interdisciplinarios III (UTEC).

**Stack:** Vue 3 + Vite + Vue Router · Node.js 22 + Express 5 · Firebase Authentication · MongoDB Atlas · Leaflet/OpenStreetMap o Google Maps.

## 1. Ejecutar en tu computadora (modo demo, sin credenciales)

Requisitos: Node.js **22** y npm.

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173 · API: http://127.0.0.1:3001/api/health
- El modo `demo` guarda todo en memoria y se reinicia al detener el backend. No envía correos: el correo se da por verificado.
- Cuentas demo (contraseña `Demo12345!`; la pantalla de ingreso tiene botones que las rellenan):
  - `cliente@hobbiz.pe`: cliente con reservas (incluye un taller ya realizado para probar reseñas).
  - `tallerista@hobbiz.pe`: tallerista aprobado.
  - `nuevo@hobbiz.pe`: tallerista **en revisión** que pide reclamar el local "Mundo de Barro".
  - `admin@hobbiz.pe`: equipo Hobbiz (panel `/admin`).

## 2. Modo real: Firebase + MongoDB Atlas

1. Copia `backend/.env.example` → `backend/.env` y `frontend/.env.example` → `frontend/.env`.
2. En `backend/.env`:
   - `HOBBIZ_MODE=firebase-mongo` y los datos de Atlas (`MONGODB_URI`, `MONGODB_PASSWORD`). Para desarrollo local usa una base aparte: `MONGODB_DB=hobbiz-dev`.
   - `FIREBASE_PROJECT_ID=hobbiz-597c5` y `ADMIN_EMAILS` con los correos del equipo.
3. Copia el JSON de la cuenta de servicio de Firebase en `backend/credentials/`. Esa carpeta está ignorada por Git.
4. Ejecuta `npm run db:check`, luego `npm run db:seed`, y por último `npm run dev`.

Detalles en [`docs/BASE_DE_DATOS.md`](docs/BASE_DE_DATOS.md).

## 3. Publicar en internet

Ver **[`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md)**:
- Frontend en Vercel (o Firebase Hosting).
- Backend en Render.
- Base de datos en Atlas M0.

El repositorio ya trae `vercel.json`, `firebase.json` y `render.yaml`.

## 4. Funciones

### Acceso
- Inicio de sesión obligatorio en toda la plataforma.
- "Recordarme" mantiene la sesión 30 días; sin marcarlo, la sesión dura hasta cerrar la pestaña.
- Recuperar contraseña por correo (Firebase).
- Verificación de correo: sin verificar no se puede reservar, reseñar ni pedir la aprobación de tallerista.
- Cada rol solo ve sus secciones.

### Cliente
- Catálogo con nombre, categoría, local, precio y horario.
- Búsqueda sin tildes y filtros: categoría, distrito, precio, día, franja horaria y hora desde/hasta.
- Vista de lista o de mapa.
- **Cerca de mí**: GPS o toque en el mapa, con radio de 500 m a 5 km.
- **Directorio de locales** (`/locales`): 35 locales.
- Ficha del taller con mapa, cupos, reseñas y página del tallerista.
- Guardados; reserva simulada (máximo 5 cupos por persona y sesión) y **cancelación** antes de que empiece el taller.
- Reseñas de 1 a 5 estrellas tras asistir al taller, públicas, editables y con promedio automático.
- Formulario de opinión.

### Tallerista
- **Verificación**: la cuenta nueva queda en revisión. Envía una solicitud, y puede reclamar la ficha de su local. El equipo la aprueba en `/admin`.
- Panel con talleres activos, cupos, ocupación, monto recaudado por taller y calificación.
- Crear taller con pin obligatorio en el mapa; fecha única o serie semanal de 2 a 8 sesiones.
- Editar, duplicar, ocultar, abrir o cerrar inscripciones.
- Ver inscritos, agenda y reseñas.
- Personalizar la página pública: colores, tipografía, distribución, portada, galería y enlaces. Las fotos se reducen automáticamente al subirlas.

### Equipo Hobbiz (`/admin`)
- Aprobar o rechazar talleristas, y traspasar la ficha del local que reclaman.
- Leer el formulario de opinión.

## 5. Comandos

```bash
npm install          # dependencias (usa el package-lock.json del repositorio)
npm run dev          # frontend + backend
npm test             # pruebas del backend
npm run build        # compila el frontend (frontend/dist)
npm run db:check     # diagnóstico de Atlas y Firebase (no escribe)
npm run db:seed      # carga los locales de talleres.pdf (o con -- --dry-run para simular)
```

## 6. Seguridad y limitaciones

- No hay pagos reales, chat, notificaciones push, IA, integración directa con redes sociales ni app móvil nativa.
- Medidas de seguridad:
  - Límite de intentos de inicio de sesión y de escrituras.
  - Cabeceras de seguridad (`helmet`).
  - CORS con lista de dominios.
  - Los datos de negocio (monto recaudado) solo los ve su tallerista.
  - Las reseñas muestran nombre e inicial, sin identificadores.
- Las fotos se guardan dentro de MongoDB, ya reducidas (~200 KB), y se sirven desde `/api/images/...` con caché. Para muchos usuarios convendría Firebase Storage o Cloudinary.
- El backend mantiene una copia de los datos en memoria: debe correr **una sola instancia**. Varias instancias requerirían reservas atómicas en MongoDB; ver `docs/BASE_DE_DATOS.md`.
- 9 de los talleres reales no tienen dirección pública. Su ubicación es aproximada y así se indica.

## 7. Documentación

| Documento | Contenido |
|---|---|
| [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md) | Paso a paso para publicar la plataforma |
| [`docs/VERIFICACION_TALLERISTAS.md`](docs/VERIFICACION_TALLERISTAS.md) | Cómo funciona la verificación y aprobación de talleristas |
| [`docs/BASE_DE_DATOS.md`](docs/BASE_DE_DATOS.md) | Modelo de datos, Firebase y Atlas, migraciones |
| [`docs/CHECKLIST_EPYC.md`](docs/CHECKLIST_EPYC.md) | Exigencias del curso y su estado |
| [`docs/TALLERES_FUENTES.md`](docs/TALLERES_FUENTES.md) | Talleres reales y fuentes |
| [`docs/INTEGRACION_SANTIAGO.md`](docs/INTEGRACION_SANTIAGO.md) | Integración de las ramas del equipo |

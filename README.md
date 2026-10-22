# Hobbiz — prototipo funcional web (frontend + backend)

Prototipo universitario de Hobbiz para **descubrir, comparar, reservar y gestionar talleres en Lima**, siguiendo las capturas de referencia: paleta naranja/terracota, fondo crema, tarjetas fotográficas, pestañas Cliente/Tallerista y navegación inferior.

> **Versión de demostración:** funciona **sin base de datos, Firebase, Google Maps ni pagos reales**. Las operaciones se guardan temporalmente **en memoria del proceso del backend** y se reinician al detenerlo. Las imágenes son ilustrativas y los talleres, reservas, precios, reseñas y personas son datos de prueba.

## 1. Requisitos

- **Node.js 20.19 o superior** (recomendado Node.js 22 LTS).
- npm y Visual Studio Code.
- Conexión a Internet **una sola vez** para instalar las dependencias de npm.

## 2. Ejecutar desde Visual Studio Code

1. Extrae el ZIP y abre la **carpeta `Hobbiz-MVP`** en VS Code (Archivo → Abrir carpeta).
2. Abre el terminal integrado (Terminal → Nuevo terminal).
3. En la raíz del proyecto ejecuta:

```bash
npm install
npm run dev
```

4. Abre **http://localhost:5173/**.
5. La API funciona en **http://localhost:3001/api/health**.

`npm run dev` levanta ambos servidores simultáneamente gracias a npm workspaces y `concurrently`; Vite redirige `/api` a Express. No es necesario crear `.env`.

Para detener ambos procesos: **Ctrl + C**. También puedes usar VS Code → Terminal → Ejecutar tarea → **Hobbiz: frontend + backend**.

### Comandos adicionales

```bash
npm run build   # compila el frontend para distribución
npm test        # pruebas funcionales del backend (Node test runner)
```

Si prefieres terminales separadas:

```bash
npm run dev --workspace backend
npm run dev --workspace frontend
```

## 3. Acceso inmediato de demostración

Al abrir la app se inicia automáticamente una **sesión demo de cliente**. En el encabezado puedes alternar entre **Cliente** y **Tallerista**; el cambio inicia la sesión demo del rol elegido.

| Rol | Correo | Contraseña |
|---|---|---|
| Cliente | `cliente@hobbiz.pe` | `Demo12345!` |
| Tallerista | `tallerista@hobbiz.pe` | `Demo12345!` |

En **Perfil** también puedes probar registro e inicio de sesión con una cuenta nueva. Para volver a las cuentas precargadas usa el conmutador de roles o «Restaurar demo».

**Importante:** las credenciales son exclusivamente de demostración. No uses estas credenciales en producción.

## 4. Funcionalidades implementadas

### Cliente

- **Inicio:** hero, categorías, catálogo fotográfico y sugerencias sencillas basadas en intereses, distrito y presupuesto.
- **Explorar:** búsqueda de texto y filtros por categoría, distrito, precio máximo y día.
- **Buscar cerca de mí:** selecciona un distrito y un radio de 3 a 25 km. Se calcula la distancia aproximada entre centros distritales; **no se utiliza GPS**.
- **Detalle:** foto, precio, descripción, fecha, horario, local, dirección, nivel requerido, materiales incluidos, materiales que debe traer el participante, instructor, cupos y reseñas.
- **Guardados:** ícono de **marcador/lazo**; favoritos vinculados a la cuenta.
- **Reserva simulada:** validación de disponibilidad, cupos actualizados, confirmación y registro visible en Perfil. No procesa dinero.
- **Reseñas:** calificación de 1 a 5 estrellas y comentario. Requiere una reserva registrada para el taller (la demo no comprueba asistencia efectiva).
- **Perfil:** nombre, intereses, presupuesto, distrito y día preferido; listado de reservas.

### Tallerista

- **Panel:** talleres activos, cupos reservados, ingreso estimado *no cobrado*, valoración media y gráficos de ocupación por taller, con filtro para seleccionar la publicación.
- **Mis talleres:** lista de publicaciones, edición, duplicación de fichas para nuevas fechas y eliminación solo si no existen reservas.
- **Crear taller:** formulario con validación en frontend y backend. **Obligatorios**: foto, título, resumen, descripción, categoría, nivel, precio, local, dirección, distrito, fecha, hora de inicio y fin, cupos, materiales incluidos y materiales que debe llevar el participante.
- **Fotos:** galería local de demostración o archivo JPG/PNG/WebP de hasta **1 MB** (guardado temporalmente en memoria).
- **Agenda:** sesiones por día y hora, filtrables por distrito, con acceso a edición.
- **Inscritos:** tabla de participantes con búsqueda, filtro por taller, código, estado y cupos reservados.
- **Reseñas:** opiniones recibidas y promedio de estrellas.

### Alcance intencionalmente excluido

Sin pasarela de pagos, chatbot/chat en tiempo real, notificaciones push, IA, verificación oficial de identidad, integración con redes sociales ni aplicación Android/iOS nativa. Tampoco hay base de datos persistente ni GPS: se incorporarán, si se aprueba, en otra etapa.

## 5. Estructura del proyecto

```text
Hobbiz-MVP/
├── backend/
│   ├── src/
│   │   ├── index.js         # servidor Express
│   │   ├── app.js           # rutas API, validaciones y lógica
│   │   └── data.js          # datos semilla y almacén temporal
│   └── test/api.test.js     # pruebas funcionales de API
├── frontend/
│   ├── public/images/      # imágenes locales ilustrativas
│   ├── src/
│   │   ├── App.vue          # shell, header y navegación
│   │   ├── router.js        # rutas del frontend
│   │   ├── style.css        # sistema de diseño responsive
│   │   ├── components/      # tarjetas, tabs, listados
│   │   ├── views/           # pantallas cliente y tallerista
│   │   └── lib/             # consumo API y sesión demo
│   └── vite.config.js       # proxy /api → backend
├── .vscode/                 # tareas y extensiones sugeridas
└── package.json            # comandos desde la raíz
```

## 6. Recorrido sugerido para la presentación

1. En **Cliente → Inicio**, observa las tarjetas y entra a **Explorar**.
2. Filtra por **Arte**, **Miraflores**, precio máximo **S/60**, sábado.
3. Prueba **«Buscar talleres cerca de mí»** y elige distrito/radio.
4. Abre **Taller de cerámica**, revisa nivel, materiales y disponibilidad.
5. Guárdalo, revisa **Guardados**, luego efectúa una **reserva simulada**.
6. En **Perfil** verifica el código de reserva.
7. Cambia a **Tallerista** con el conmutador del encabezado. Revisa **Resumen**, ocupación y **Mis talleres**.
8. Crea una nueva publicación. Si falta información, no podrás guardarla.
9. Abre **Agenda** e **Inscritos**: verás los datos derivados de las reservas. Prueba editar una publicación.

## 7. API principal

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Estado del servidor |
| GET | `/api/meta` | Distritos, categorías, galería de imágenes |
| POST | `/api/auth/login` | Inicio de sesión de demostración |
| POST | `/api/auth/register` | Registrar cuenta temporal |
| GET / PATCH | `/api/auth/me`, `/api/me` | Ver / editar perfil |
| GET | `/api/workshops` | Catálogo y filtros: `q`, `category`, `district`, `maxPrice`, `day`, `near`, `radiusKm` |
| GET | `/api/workshops/:id` | Ficha completa |
| GET | `/api/recommendations` | Recomendaciones por reglas simples |
| GET/POST/DELETE | `/api/me/favorites`, `/api/me/favorites/:id` | Guardados |
| POST | `/api/workshops/:id/bookings` | Reserva con control de cupos |
| GET | `/api/me/bookings` | Mis reservas |
| GET / POST | `/api/workshops/:id/reviews` | Consultar / publicar reseñas |
| GET | `/api/instructor/dashboard` | Indicadores |
| GET / POST | `/api/instructor/workshops` | Lista / crear publicaciones |
| PUT / DELETE | `/api/instructor/workshops/:id` | Editar / eliminar |
| GET | `/api/instructor/bookings` | Inscritos |
| GET | `/api/instructor/schedule` | Agenda |
| GET | `/api/instructor/reviews` | Reseñas de sus talleres |

Para rutas privadas envía `Authorization: Bearer <token>`. La autenticación, la seguridad, la concurrencia y el almacenamiento aquí están pensados **solo para un único proceso de demostración**; la migración a producción requerirá persistencia, control transaccional multi-instancia, sesiones seguras y medidas adicionales.

## 8. Próxima etapa técnica

1. Sustituir `backend/src/data.js` por repositorios persistentes (MongoDB/SQL).
2. Integrar un proveedor de identidad si se decide (Firebase Authentication, por ejemplo).
3. Sustituir imágenes base64 por almacenamiento de objetos.
4. Probar concurrencia real de reservas en una base de datos transaccional.
5. Configurar despliegue y seguridad antes de exponer el sistema a Internet.

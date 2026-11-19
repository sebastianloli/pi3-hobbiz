# Despliegue de Hobbiz

Arquitectura recomendada, gratuita para el prototipo:

```
Navegador ──► Frontend estático (Vercel)  ──►  API Express (Render, plan free) ──► MongoDB Atlas (M0)
                    │                                   │
                    └──── Firebase Authentication ◄─────┘ (el backend verifica los tokens)
```

El repositorio ya incluye `vercel.json` (frontend), `render.yaml` (backend) y `firebase.json` (alternativa: Firebase Hosting).

## 0. Antes de empezar (una sola vez)

- [ ] **Cambiar las claves que se compartieron por chat:** la contraseña del usuario de Atlas y la clave de la cuenta de servicio de Firebase. Genera una nueva en Firebase → Configuración del proyecto → Cuentas de servicio.
- [ ] Atlas → **Database Access**: un usuario solo para la API (p. ej. `hobbiz-api`) con rol *readWrite* sobre la base `hobbiz`.
- [ ] Atlas → **Network Access**: agrega `0.0.0.0/0`, porque Render no tiene una IP fija en el plan gratuito. La contraseña fuerte es la protección.
- [ ] Desde tu PC, con un `backend/.env` que apunte a la base de producción (`MONGODB_DB=hobbiz`):
  ```bash
  npm run db:check
  npm run db:seed -- --dry-run
  npm run db:seed
  ```
- [ ] Para codificar la cuenta de servicio, en una terminal (Git Bash en Windows):
  ```bash
  base64 -w0 cuenta-servicio.json > cuenta-servicio.b64
  ```
  Copia el contenido de ese archivo, **no lo subas a Git** y bórralo después.

## 1. Backend en Render

1. https://render.com → **New → Blueprint** → elige el repositorio. Render lee `render.yaml` y crea `hobbiz-api`.
   Si prefieres hacerlo a mano: **New → Web Service**, Runtime Node, Build `npm ci --omit=dev -w backend`, Start `npm start`, Health check `/api/health`.
2. Completa las variables marcadas como secretas:

| Variable | Valor |
|---|---|
| `MONGODB_URI` | `mongodb+srv://hobbiz-api:<db_password>@hobbiz-demo.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=hobbiz-demo` |
| `MONGODB_PASSWORD` | contraseña del usuario `hobbiz-api` |
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | contenido de `cuenta-servicio.b64` |
| `CORS_ORIGIN` | dominio del frontend, p. ej. `https://hobbiz.vercel.app` (varios separados por comas) |
| `ADMIN_EMAILS` | correos del equipo que aprueban talleristas |

   Ya vienen fijas en `render.yaml`: `NODE_ENV=production`, `NODE_VERSION=22`, `HOBBIZ_MODE=firebase-mongo`, `MONGODB_DB=hobbiz`, `MONGODB_SEED_CATALOG=false`, `FIREBASE_PROJECT_ID=hobbiz-597c5` y `TRUST_PROXY=1`.
3. Despliega y comprueba que `https://hobbiz-api.onrender.com/api/health` responda `{"status":"ok","mode":"firebase-mongo",...}`.

> Si falta `CORS_ORIGIN` o `HOBBIZ_MODE`, el servidor **no arranca a propósito**: así nunca queda publicado el modo demo, que tiene contraseñas conocidas. Revisa los *Logs* de Render.

**Plan free de Render:** el servicio se duerme tras 15 minutos sin uso y tarda unos 30 a 60 segundos en despertar. Mientras tanto la app muestra "Despertando el servidor…". Para la presentación, abre la web unos minutos antes o configura un monitor gratuito (p. ej. UptimeRobot) que consulte `/api/health` cada 10 minutos.

## 2. Frontend en Vercel

1. https://vercel.com → **Add New → Project** → importa el repositorio.
   - Root Directory: la **raíz** del repositorio, no `frontend`.
   - Vercel lee `vercel.json`: instala con `npm ci`, compila con `npm run build` y publica `frontend/dist`, con redirección de rutas para la SPA.
   - En Settings → General, Node.js Version: **22.x**.
2. **Environment Variables** (Production):

| Variable | Valor |
|---|---|
| `VITE_API_URL` | `https://hobbiz-api.onrender.com` (sin `/api`) |
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MESSAGING_SENDER_ID` | los de `frontend/.env.example` (son públicos) |
| `VITE_GOOGLE_MAPS_API_KEY` | opcional |

3. Despliega. Cada vez que cambies una variable `VITE_*` hay que **volver a desplegar**, porque se incorporan al compilar.
4. Copia el dominio final (p. ej. `https://hobbiz.vercel.app`) en `CORS_ORIGIN` de Render.

**Alternativa, Firebase Hosting** (el dominio `hobbiz-597c5.web.app` ya está autorizado en Firebase Auth):
```bash
npm ci
VITE_API_URL=https://hobbiz-api.onrender.com npm run build
npx firebase-tools login
npx firebase-tools deploy --only hosting --project hobbiz-597c5
```
En ese caso usa `CORS_ORIGIN=https://hobbiz-597c5.web.app,https://hobbiz-597c5.firebaseapp.com`.

## 3. Firebase

- [ ] Authentication → Método de acceso: **Correo electrónico/contraseña** activado.
- [ ] Authentication → Configuración → **Dominios autorizados**: agrega `hobbiz.vercel.app` (o tu dominio).
- [ ] Authentication → **Plantillas**: personaliza en español el correo de verificación y el de restablecer contraseña.
- [ ] Si usas Google Maps: en Google Cloud → Credenciales, restringe la clave a `https://hobbiz.vercel.app/*`.

## 4. Prueba final (smoke test)

1. Abre directamente `https://hobbiz.vercel.app/locales`. Debe cargar sin 404 y pedir inicio de sesión.
2. Crea una cuenta de cliente. Debe llegarte el correo de verificación; ábrelo y pulsa "Ya lo verifiqué".
3. Reserva un taller y luego cancélalo desde Perfil.
4. Con un correo de `ADMIN_EMAILS`, crea una cuenta y verifica el correo; debe aparecer el botón **Admin**.
5. Crea una cuenta de tallerista, envía la solicitud y apruébala desde `/admin`. Luego publica un taller con su pin en el mapa.
6. En Render, **Manual Deploy → Restart** y comprueba que todo sigue ahí (persistencia en Atlas).
7. Abre la consola del navegador (F12): no debe haber errores de CORS.

## 5. Reglas para no romper producción

- **Una sola instancia** del backend: mantiene una copia de los datos en memoria. No subas el número de instancias en Render.
- **No conectes `npm run dev` de tu PC a la base de producción** (`MONGODB_DB=hobbiz`). Usa `hobbiz-dev` para desarrollar: dos servidores sobre la misma base se pisarían los cambios.
- `npm run db:seed` contra producción es seguro (no duplica ni pisa datos editados), pero reinicia el servicio en Render después para que lo vea.
- Las sesiones de ejemplo vencidas se renuevan solas en cada arranque del backend.

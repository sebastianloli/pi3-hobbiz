# Verificación y aprobación de talleristas

Objetivo: que solo publiquen talleres las personas que **controlan su correo** y que **el equipo de Hobbiz aprobó**. Así se evitan cuentas falsas y que alguien se haga pasar por un taller real.

## Flujo

```
Registro (tallerista) ──► Firebase envía el correo de verificación
        │                         │
        │                  la persona abre el enlace ──► "Ya lo verifiqué" en la app
        ▼
Cuenta "en revisión" (instructorStatus: pending)
  · puede personalizar su perfil
  · NO puede publicar talleres ni aparece en el directorio
        │
        ▼
Solicitud de verificación (Resumen del tallerista)
  · mensaje: quién es y su rol en el taller
  · contacto: Instagram o teléfono del taller
  · opcional: "mi taller ya está en el directorio" → elige el local a reclamar
        │
        ▼
Equipo Hobbiz en /admin (correos de ADMIN_EMAILS, con correo verificado)
  · confirma por Instagram, teléfono o en persona
  · Aprobar  → instructorStatus: approved (puede publicar). Si reclamó un local, se le traspasan
               la ficha y sus sesiones, y la ficha original se archiva.
  · Rechazar → instructorStatus: rejected + motivo (lo ve y puede volver a enviar la solicitud)
```

## Qué se verifica y dónde

| Control | Dónde se aplica |
|---|---|
| Correo verificado (Firebase, `email_verified` en el token) | Backend: reservar, reseñar y enviar la solicitud de tallerista responden 403 sin él. Frontend: un aviso con "Reenviar" y "Ya lo verifiqué". |
| Tallerista aprobado | Backend: crear y editar talleres responden 403 si no está aprobado. Su perfil no es público ni sale en el directorio hasta la aprobación. |
| Administrador | `ADMIN_EMAILS` en el backend y correo verificado. Solo ellos usan `/api/admin/*` y ven `/admin`. |
| Talleristas que ya existían | La migración los marca como aprobados, para no bloquear cuentas en uso. |

En **modo demo** no se envían correos y el correo se da por verificado. La aprobación sí se aplica: prueba con `nuevo@hobbiz.pe` (en revisión) y `admin@hobbiz.pe`.

## Configuración en Firebase (modo real)

1. **Authentication → Plantillas:** personaliza en español el correo de *verificación de dirección de correo* y el de *restablecimiento de contraseña* (nombre del remitente "Hobbiz").
2. **Authentication → Configuración → Dominios autorizados:** agrega el dominio publicado (p. ej. `hobbiz.vercel.app`). Los enlaces de los correos vuelven a ese dominio.
3. **Backend:** `ADMIN_EMAILS=correo1@...,correo2@...`. Esas personas crean su cuenta normal en Hobbiz (como cliente) y verifican su correo. Desde entonces ven el botón "Admin".

## Endpoints

| Método | Ruta | Quién |
|---|---|---|
| POST | `/api/instructor/verification` `{ claimVenueId?, message, contact? }` | Tallerista con correo verificado |
| GET | `/api/admin/instructors?status=pending\|approved\|rejected\|all` | Administración |
| POST | `/api/admin/instructors/:id/approve` `{ transferVenue: true }` | Administración |
| POST | `/api/admin/instructors/:id/reject` `{ reason }` | Administración |
| GET | `/api/admin/feedback` | Administración |

Campos nuevos en `users`: `instructorStatus`, `verificationRequest`, `emailVerified`, `approvedAt`, `approvedBy`, `rejectionReason`. En la ficha reclamada: `archived: true`, `archivedReason: 'reclamado'`, `claimedBy`.

## Posibles mejoras

- Avisar por correo al tallerista cuando su cuenta se aprueba o se rechaza (Firebase Extensions "Trigger Email" o un servicio como Resend).
- Pedir un documento, como el RUC del taller, y guardarlo en Firebase Storage para revisarlo.

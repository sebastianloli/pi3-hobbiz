# Pruebas manuales — Hobbiz integrado

Ejecuta `npm install && npm run dev` en Visual Studio Code. Para probar Firebase/Mongo primero configura los `.env` de frontend y backend como explica README.

## Cliente

- [ ] Abrir Inicio y comprobar que carga el catálogo con fotografías, precios, fechas y valoraciones.
- [ ] Explorar y filtrar por palabra clave, distrito, precio máximo, categoría y día.
- [ ] Usar «Cerca de mi distrito» y cambiar radio.
- [ ] Dar permiso a «Usar mi ubicación (GPS)», comprobar resultados aproximados y repetir denegando el permiso para verificar alternativa manual.
- [ ] Abrir un taller, revisar los datos completos y guardarlo; comprobar la sección Guardados.
- [ ] Reservar 1 cupo y comprobar confirmación, reducción de disponibilidad y reserva en perfil.
- [ ] Abrir «Mi agenda» y seleccionar un mes con reservas.
- [ ] Publicar una reseña desde un taller con reserva; comprobar el promedio y que no se puede valorar un taller no reservado.
- [ ] Completar formulario de opinión desde Guía de flujo.

## Tallerista

- [ ] Cambiar a vista tallerista en modo demo (en Firebase usar la cuenta del rol correspondiente).
- [ ] Crear taller comprobando que los campos vacíos bloquean la publicación.
- [ ] Publicar 3 sesiones semanales; confirmar que cada una tiene fecha y cupos independientes.
- [ ] Editar precio/cupos, ocultar publicación, volver a publicarla, duplicarla y revisar su ficha.
- [ ] Comprobar que un taller lleno desaparece de la exploración general pero aparece si se busca su nombre exacto.
- [ ] Revisar agenda, lista de inscritos y estadísticas con reservas nuevas.
- [ ] Abrir «Personalizar perfil», guardar nombre de estudio, descripción, enlace HTTPS y paleta; verificar cambios en una ficha propia.

## Firebase + MongoDB: comprobaciones adicionales

- [ ] Registrar una cuenta real cliente y una real tallerista en `/cuenta` (Firebase Email/Password).
- [ ] Usar credenciales reales y comprobar que el backend devuelve `/api/auth/me`.
- [ ] No poder gestionar publicaciones con un usuario de rol cliente (HTTP 403).
- [ ] Crear/editar un taller, realizar reserva, guardar como favorito, valorar y **reiniciar backend**: todos los datos deberían persistir.
- [ ] Verificar que un token inválido responde HTTP 401.
- [ ] No incluir ningún `.env` ni JSON de cuenta de servicio en `git status`.

## Comandos

```powershell
npm test
npm run build
```

Nota: para el modo de demostración las cuentas son `cliente@hobbiz.pe` y `tallerista@hobbiz.pe`, con contraseña `Demo12345!`. Esos accesos solo existen en `HOBBIZ_MODE=demo`.

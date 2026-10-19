# Checklist de validación — Hobbiz

Ejecutar con ambos procesos iniciados: `npm run dev`.

## Cliente

- [ ] Inicio muestra 8 talleres con fotografía, nombre, precio, ubicación, hora y estrellas.
- [ ] Seleccionar categoría Arte actualiza la lista visible.
- [ ] Explorar → buscar "cerámica" muestra el taller correspondiente.
- [ ] Explorar → filtrar Arte, Miraflores, máximo S/60 y sábado devuelve Cerámica.
- [ ] Cerca de mí → Miraflores, radio de 5 km muestra talleres cercanos (distancia aproximada).
- [ ] Guardar/quitar una publicación actualiza Guardados.
- [ ] Detalle muestra descripción, ubicación, local, nivel, horarios, materiales y cupos.
- [ ] Reservar 1 cupo devuelve confirmación y código; el número de cupos baja.
- [ ] Perfil → Mis reservas muestra la nueva reserva.
- [ ] Crear reseña de 1 a 5 estrellas y comentario de mínimo 8 caracteres tras reservar.
- [ ] Editar preferencias y regresar a Inicio modifica recomendaciones.

## Tallerista

- [ ] Cambiar a Tallerista desde la parte superior muestra panel de métricas.
- [ ] El panel permite seleccionar una publicación para filtrar las barras de ocupación.
- [ ] Mis talleres lista las publicaciones y permite editar.
- [ ] Crear nuevo taller impide guardar cuando faltan campos requeridos.
- [ ] Completar foto, nombre, resumen, descripción, categoría, precio, nivel, local, ubicación, cupos, horarios y materiales publica el taller.
- [ ] Nuevo taller aparece en Mis talleres y en el catálogo de Cliente.
- [ ] Duplicar copia la ficha para asignarle otra fecha.
- [ ] Agenda muestra nuevos horarios, y editar permite cambiarlos.
- [ ] Inscritos muestra las reservas asociadas a cada taller.
- [ ] Panel refleja las inscripciones nuevas tras cambiar de rol.
- [ ] Reseñas muestra las valoraciones recibidas.
- [ ] No se permite eliminar un taller que tenga reservas activas.

## Límites intencionales

- [ ] Reiniciar Node vuelve a dejar los datos de ejemplo como al comienzo.
- [ ] No se solicita configurar MongoDB, Firebase, claves de pago o de mapas.
- [ ] Se informa que los pagos son simulados y la ubicación se aproxima por distrito.

**Nota:** los tests automáticos de la API están en `backend/test/api.test.js`. Se ejecutan con `npm test` después de `npm install`.

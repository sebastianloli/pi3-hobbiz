# Checklist de alcance Hobbiz — revisión del primer prototipo integrado

**Fecha de revisión:** 22/10/2026. **Fuente:** alcance y lista de exigencias/deseos mostrados por el equipo. Distinguimos **implementado en código** de **verificado ejecutándose**.

| ID | Tipo | Exigencia / deseo | Implementación del código | Verificación y observaciones |
|---|---|---|---|---|
| E01 | E | Catálogo de talleres (nombre, categoría, precio, zona, fecha, horario) | ✅ | API `GET /api/workshops`; Inicio, Explorar y tarjetas; verificar visualmente con datos demo. |
| E02 | E | Registro e inicio de sesión y perfiles de cliente/tallerista | ✅ | Modo demo + modo Firebase verificado por UID con perfiles en MongoDB; pendiente probar Firebase/Atlas con credenciales reales. |
| E03 | E | Búsqueda manual, filtros y cercanía | ✅ con precisión limitada | Texto, categoría, distrito, precio, día y radio; GPS opcional vía permiso del navegador. Talleres georreferenciados **por centro de distrito**, no por dirección exacta. |
| E04 | E | Formulario de opinión sobre facilidad/nuevas funciones | ✅ | `/opinion` y `POST /api/feedback`; en demo el comentario solo vive durante la ejecución. |
| E05 | E | Guardados y edición de preferencias | ✅ | Marcador, lista, intereses, presupuesto, zona y día favorito; Firebase y Mongo persisten en modo conectado. |
| E06 | E | Reserva simulada, confirmación y actualización de cupos | ✅ | Reserva autenticada y contador de cupos; cola por proceso; sin cobro. **Pendiente transacciones MongoDB para despliegue en múltiples procesos**. |
| E07 | E | Personalización del perfil del tallerista | ◐ Parcial | Nombre de estudio, biografía, foto de portada, enlace HTTPS y 3 paletas; no se permite diseñar libremente una plantilla/estética arbitraria. Requiere validación con usuarios para dar por cerrado el alcance original. |
| E08 | E | Crear y editar talleres con estructura completa | ✅ | Título, fotos, resumen, descripción, categoría, local, dirección, nivel, materiales, precio, cupos, fecha y horario obligatorios; validación en servidor. |
| E09 | E | Talleres de ocasión o recurrentes | ✅ acotado | Sesiones individuales o series semanales de 2–8 fechas con cupos independientes. Falta editor masivo de series si el requerimiento lo exige. |
| E10 | E | Ocultar talleres sin cupos salvo búsqueda exacta | ✅ | Filtrado en `/api/workshops`; la ficha es accesible por enlace directo para explicar que está agotado. |
| E11 | E | Inscritos e ingreso generado | ✅ con matiz | Vista de personas inscritas, ocupación y **monto estimado** (cupos × precio). Como no hay pagos, NO es dinero cobrado ni contabilidad real. |
| E12 | E | Reseñas públicas y rating promedio sobre 5 | ✅ | Estrellas 1–5 y comentario, promedio automático; para publicar se requiere reserva. |
| E13 | E | Interfaz web responsive y separación frontend/backend | ✅ por diseño | Vue + Express; pendiente pruebas reales en móviles/navegadores y `npm run build` local. |
| E14 | E | Persistencia de usuarios, talleres, reservas y valoraciones | ✅ código preparado / ⚠️ sin prueba conectada | MongoDB en `firebase-mongo`; inicialización y escrituras implementadas. Requiere credenciales privadas y prueba end-to-end en equipo. |
| D01 | D | Calendario personal | ✅ adicional | `/agenda` con reservas agrupadas por mes. |
| D02 | D | Recordatorio previo | ◐ Parcial | Aviso visible en `/agenda` hasta 48h antes, sin correo, push ni tarea programada. |
| D03 | D | Sugerencias según intereses | ✅ | Inicio: motor de reglas simple por categoría, precio y distrito; sin IA. |

## Fuera del alcance (se conserva expresamente)

- Pagos reales con Yape, Plin, tarjeta u otra pasarela.
- Recomendador basado en IA o aprendizaje automático.
- Mensajería/chat en tiempo real entre cliente y tallerista.
- Notificaciones push, correo programado y recordatorios automáticos fuera de la web.
- Verificación documental o de identidad del tallerista.
- Integración directa con Instagram, TikTok, WhatsApp y Google Maps.
- Aplicación móvil nativa; se proporciona web responsive.
- Analítica predictiva/avanzada, inventarios o administración contable.

## Verificaciones que faltan para declarar EPY2 completamente cumplido

1. **Pruebas de instalación en Visual Studio Code:** `npm install`, `npm test` y `npm run build` en un ordenador con npm y acceso a Registry.
2. **Prueba Firebase real:** activar Email/Password, registrar un cliente y tallerista, cerrar/abrir sesión y verificar que las rutas de ambos roles respetan la autorización.
3. **Prueba MongoDB real:** crear un taller, reservar, guardar, comentar, reiniciar el servidor y confirmar persistencia de cada dato.
4. **Prueba funcional cruzada:** un cliente reserva un taller nuevo y el tallerista ve un inscrito adicional; confirmar que el aforo restante sea correcto.
5. **Validación de usabilidad:** al menos una persona que no conoce el prototipo debe encontrar, reservar y valorar un taller con observación de dificultades.
6. **Requisito de personalización libre:** acordar con el docente si una selección controlada de paletas/biografía/enlace satisface la exigencia; si no, ampliar el editor dentro de las 16 semanas.
7. **Robustez MongoDB multiinstancia:** si se publica en más de un proceso o servicio, implementar reservas transaccionales para impedir sobreventa entre instancias. La versión entregada es de prototipo local de una instancia.
8. **Ubicación:** decidir con el equipo si usar el centro del distrito es suficientemente preciso para la demostración de “cerca de mí”; si se necesita ubicación exacta del taller, almacenar sus coordenadas reales o geocodificar su dirección.
9. **Series recurrentes:** si se exigen aperturas/cierres periódicos automáticos o edición conjunta de una serie, esa automatización sigue pendiente.
10. **Accesibilidad y seguridad:** revisar navegación por teclado/lectores de pantalla, límites de peticiones y manejo seguro de imágenes antes de cualquier despliegue público.

**Validación realizada en esta entrega:** revisión estática del código, `node --check` de JavaScript y scripts Vue, listado de rutas y comprobación de ZIP; **no se pudo ejecutar `npm install` ni el test runner en el entorno de generación porque el registro npm no estaba accesible**. Los tests automatizados quedan incluidos para ejecutarlos localmente.

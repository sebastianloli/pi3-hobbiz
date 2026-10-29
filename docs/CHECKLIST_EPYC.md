# Checklist de alcance Hobbiz — revisión del primer prototipo integrado

**Fecha de revisión:** 29/10/2026, validada con agentes de prueba sobre la app en ejecución. Antes: 22/10/2026. **Fuente:** alcance y lista de exigencias/deseos mostrados por el equipo. Distinguimos **implementado en código** de **verificado ejecutándose**.

| ID | Tipo | Exigencia o alcance | Estado | Cómo se verifica |
|---|---|---|---|---|
| E01 | E | Catálogo con nombre, categoría, ubicación, precio y horario | ✅ | Inicio, `/explorar` (lista o mapa) y la ficha. 24 talleres reales de Miraflores y Barranco más 3 de la cuenta demo. Las tarjetas muestran categoría y horario de inicio a fin. |
| E02 | E | GPS y búsqueda manual en **apartados separados**, y formulario de opinión | ✅ | `/explorar` (búsqueda manual) y `/cerca` (GPS o toque en el mapa) están en la barra inferior. `/opinion` pregunta por la facilidad de uso, las nuevas funciones, qué fue confuso y una recomendación o crítica; se llega desde la cabecera, Perfil y el panel. |
| E03 | E | Guardar con marcador y ver en Guardados; preferencias | ✅ | El marcador en tarjetas y fichas usa un estado compartido. Solo los clientes guardan, y los talleres ocultos salen de Guardados. Preferencias en Perfil y Mi cuenta. |
| E04 | E | Reserva: registra, actualiza cupos y confirma | ✅ | Muestra un código de confirmación, actualiza los cupos y aparece en Perfil. Bloquea la sobreventa, las inscripciones cerradas y los talleres ya realizados. |
| E05 | E | Estética, descripciones y links a decisión del tallerista; consulta de estética | ✅ | `/tallerista/perfil`: cuestionario "¿Qué estética quieres?" y control total de color (incluido uno propio), tipografía, distribución, portada, galería y 5 enlaces. Página pública en `/estudio/:id`. El panel invita a personalizar si el perfil está vacío. |
| E06 | E | Crear con estructura predefinida, de ocasión o recurrente, editar, ver inscritos y monto; agotados ocultos salvo el nombre exacto | ✅ | Editor con campos obligatorios y pin en el mapa. Fecha única o serie semanal. Abrir o cerrar inscripciones. El monto recaudado se calcula con el precio pagado en cada reserva. Un taller agotado aparece solo al buscar el nombre exacto del taller o del local, con la etiqueta "No hay más cupos". |
| E07 | E | Reseñas públicas, nota sobre 5 y promedio automático | ✅ | Solo reseña quien reservó; se puede editar la reseña propia. Las reseñas son visibles para clientes y talleristas, también en la página del estudio. |
| A01 | Alcance | Registro e inicio de sesión **obligatorio**, con "Recordarme" | ✅ | Guardas en el router y la API. Recordarme: 30 días con `localStorage` o persistencia local de Firebase; sin la casilla, `sessionStorage` y 8 horas. Si la sesión se pierde, vuelve al ingreso. |
| A02 | Alcance | Filtros por categoría, ubicación, precio y horario | ✅ | Categoría, distrito, precio máximo, día y franja (mañana, tarde o noche). La búsqueda ignora tildes. |
| A03 | Alcance | Buscar talleres cerca de mí | ✅ | Distancia real hasta el pin de cada taller, con radio de 500 m a 5 km y círculo en el mapa. 9 talleres reales tienen pin aproximado y así se indica. |
| A04 | Alcance | Solo Miraflores y Barranco | ✅ | El backend valida el pin dentro del **polígono** de cada distrito; se rechazan puntos en Surquillo, Surco, Chorrillos o el mar. Los contornos se dibujan en el mapa. |
| A05 | Alcance | Base de datos de usuarios, talleres, reservas y valoraciones | ✅ con código / ⚠️ falta una prueba con Atlas | Ver [`BASE_DE_DATOS.md`](BASE_DE_DATOS.md). |
| A06 | Alcance | Interfaz responsive | ✅ | Sin scroll horizontal a 390 px en todas las rutas, según la validación automatizada. |

> **Deseos (D):** el calendario personal, los recordatorios y las sugerencias vienen del MVP anterior y no se trabajaron en esta iteración, que se centró en las exigencias.

## Fuera del alcance (se conserva expresamente)

- Pagos reales con Yape, Plin, tarjeta u otra pasarela.
- Recomendador basado en IA o aprendizaje automático.
- Mensajería/chat en tiempo real entre cliente y tallerista.
- Notificaciones push, correo programado y recordatorios automáticos fuera de la web.
- Verificación documental o de identidad del tallerista.
- Integración directa con Instagram, TikTok o WhatsApp (solo hay enlaces). El mapa usa Leaflet y OpenStreetMap, que son gratuitos.
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

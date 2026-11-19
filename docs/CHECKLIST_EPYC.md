# Checklist de alcance Hobbiz — revisión del primer prototipo integrado

**Fecha de revisión:** 29/10/2026, validada con agentes de prueba sobre la app en ejecución. Antes: 22/10/2026. **Fuente:** alcance y lista de exigencias/deseos mostrados por el equipo. Distinguimos **implementado en código** de **verificado ejecutándose**.

| ID | Tipo | Exigencia o alcance | Estado | Cómo se verifica |
|---|---|---|---|---|
| E01 | E | Catálogo con nombre, categoría, ubicación, precio y horario | ✅ | Inicio, `/explorar` (lista o mapa) y la ficha. 24 talleres reales de Miraflores y Barranco más 3 de la cuenta demo. Las tarjetas muestran categoría y horario de inicio a fin. |
| E02 | E | GPS y búsqueda manual en **apartados separados**, y formulario de opinión | ✅ | `/explorar` (búsqueda manual) y `/cerca` (GPS o toque en el mapa) están en la barra inferior. `/opinion` pregunta por la facilidad de uso, las nuevas funciones, qué fue confuso y una recomendación o crítica; se llega desde la cabecera, Perfil y el panel. |
| E03 | E | Guardar con marcador y ver en Guardados; preferencias | ✅ | El marcador en tarjetas y fichas usa un estado compartido. Solo los clientes guardan, y los talleres ocultos salen de Guardados. Preferencias en Perfil y Mi cuenta. |
| E04 | E | Reserva: registra, actualiza cupos y confirma | ✅ (+ cancelación y máx. 5 cupos por persona) | Muestra un código de confirmación, actualiza los cupos y aparece en Perfil. Bloquea la sobreventa, las inscripciones cerradas y los talleres ya realizados. |
| E05 | E | Estética, descripciones y links a decisión del tallerista; consulta de estética | ✅ | `/tallerista/perfil`: cuestionario "¿Qué estética quieres?" y control total de color (incluido uno propio), tipografía, distribución, portada, galería y 5 enlaces. Página pública en `/estudio/:id`. El panel invita a personalizar si el perfil está vacío. |
| E06 | E | Crear con estructura predefinida, de ocasión o recurrente, editar, ver inscritos y monto; agotados ocultos salvo el nombre exacto | ✅ | Editor con campos obligatorios y pin en el mapa. Fecha única o serie semanal. Abrir o cerrar inscripciones. El monto recaudado se calcula con el precio pagado en cada reserva. Un taller agotado aparece solo al buscar el nombre exacto del taller o del local, con la etiqueta "No hay más cupos". |
| E07 | E | Reseñas públicas, nota sobre 5 y promedio automático | ✅ | Solo reseña quien reservó; se puede editar la reseña propia. Las reseñas son visibles para clientes y talleristas, también en la página del estudio. |
| A01 | Alcance | Registro e inicio de sesión **obligatorio**, con "Recordarme" | ✅ (+ verificación de correo, recuperar contraseña, aprobación de talleristas) | Guardas en el router y la API. Recordarme: 30 días con `localStorage` o persistencia local de Firebase; sin la casilla, `sessionStorage` y 8 horas. Si la sesión se pierde, vuelve al ingreso. |
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

1. **Prueba con Firebase y Atlas reales**, ya publicada (ver `DESPLIEGUE.md`, sección 4): registro con verificación de correo, reserva y cancelación, reseña, aprobación de un tallerista y persistencia tras reiniciar.
2. **Validación de usabilidad:** al menos una persona que no conoce la plataforma debe encontrar, reservar y valorar un taller, observando sus dificultades.
3. **Personalización libre (E05):** confirmar con el docente que el cuestionario de estética más el control de colores, tipografía, distribución, fotos y enlaces cumple la exigencia.
4. **Escala:** con varias instancias del backend harían falta reservas atómicas en MongoDB. Para el prototipo se usa una sola instancia.

**Validación automatizada (19/11/2026):** `npm test` pasa los 39 tests, que incluyen la seguridad, las reservas y su cancelación, las reseñas, la verificación de talleristas, la migración y los bloqueos de arranque en producción. `npm run build` compila sin errores.

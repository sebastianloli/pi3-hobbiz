<script setup>
// Proveedor Google Maps (Maps JavaScript API). Misma interfaz que LeafletMap.vue: pines con ventana
// de información, punto del usuario con radio, contornos de distrito y selección de un punto con clic.
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { loadGoogleMaps } from '../lib/googleMaps'
import { money } from '../lib/state'

const props = defineProps({
  markers: { type: Array, default: () => [] },
  center: { type: Array, default: () => [-12.135, -77.025] },
  zoom: { type: Number, default: 14 },
  userPoint: { type: Array, default: null },
  radiusKm: { type: Number, default: 0 },
  pickable: { type: Boolean, default: false },
  picked: { type: Array, default: null },
  height: { type: String, default: '420px' },
  fit: { type: Boolean, default: true },
  areas: { type: Object, default: null },
})
const emit = defineEmits(['pick', 'failed'])
const router = useRouter()
const el = ref(null)
let g, map, info, markers = [], areaShapes = [], userMarker, circle, pickMarker, lastFit = ''

const ll = ([lat, lon]) => ({ lat, lng: lon })
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
// Pin con la misma forma y colores que en Leaflet (símbolo SVG, no requiere Map ID).
const pin = (color) => ({ path: 'M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z', fillColor: color, fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2.5, scale: 1, anchor: new g.Point(12, 36) })

function drawMarkers() {
  if (!map) return
  markers.forEach(m => m.setMap(null)); markers = []
  const bounds = new g.LatLngBounds()
  for (const m of props.markers) {
    if (!Number.isFinite(m.lat) || !Number.isFinite(m.lon)) continue
    const marker = new g.Marker({ map, position: ll([m.lat, m.lon]), title: m.title, icon: pin(m.available > 0 ? '#c65c38' : '#9b8f84') })
    marker.addListener('click', () => {
      const box = document.createElement('div')
      box.className = 'hb-popup'
      box.innerHTML = `<b>${esc(m.title)}</b><span>${esc(m.venue || '')}</span><span>${esc(m.district)} · ${money(m.price)}${m.distanceKm != null ? ` · ${m.distanceKm} km` : ''}</span><span>${m.available > 0 ? `${m.available} cupos` : 'Sin cupos'}</span>`
      if (m.id) { const b = document.createElement('button'); b.type = 'button'; b.className = 'hb-popup-link'; b.textContent = 'Ver taller →'; b.onclick = () => router.push(`/taller/${m.id}`); box.appendChild(b) }
      info.setContent(box); info.open({ map, anchor: marker })
    })
    markers.push(marker); bounds.extend(ll([m.lat, m.lon]))
  }
  const key = props.markers.map(m => `${m.lat},${m.lon}`).join('|')
  if (!props.fit || key === lastFit) return
  lastFit = key
  if (markers.length > 1) map.fitBounds(bounds, 30)
  else if (markers.length === 1 && !props.userPoint) { map.setCenter(markers[0].getPosition()); map.setZoom(16) }
}
function drawAreas() {
  if (!map) return
  areaShapes.forEach(a => a.setMap(null))
  areaShapes = Object.values(props.areas || {}).map(poly => new g.Polygon({ map, paths: poly.map(ll), strokeColor: '#3f7d4e', strokeOpacity: 0.9, strokeWeight: 2, fillColor: '#3f7d4e', fillOpacity: 0.05, clickable: false }))
}
function drawUser() {
  if (!map) return
  userMarker?.setMap(null); circle?.setMap(null); userMarker = circle = null
  if (!props.userPoint) return
  userMarker = new g.Marker({ map, position: ll(props.userPoint), title: 'Tu ubicación de referencia', icon: { path: g.SymbolPath.CIRCLE, scale: 9, fillColor: '#2f6fb0', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 3 } })
  if (props.radiusKm > 0) {
    circle = new g.Circle({ map, center: ll(props.userPoint), radius: props.radiusKm * 1000, strokeColor: '#c65c38', strokeWeight: 2, fillColor: '#c65c38', fillOpacity: 0.06, clickable: false })
    map.fitBounds(circle.getBounds(), 20)
  }
}
function drawPicked() {
  if (!map) return
  pickMarker?.setMap(null); pickMarker = null
  if (props.picked && Number.isFinite(props.picked[0])) pickMarker = new g.Marker({ map, position: ll(props.picked), icon: pin('#3f7d4e') })
}

onMounted(async () => {
  try { g = await loadGoogleMaps() } catch { emit('failed'); return }
  if (!el.value) return
  map = new g.Map(el.value, { center: ll(props.picked || props.center), zoom: props.picked && !props.markers.length ? 16 : props.zoom, mapTypeControl: false, streetViewControl: false, fullscreenControl: true, gestureHandling: 'cooperative', clickableIcons: false })
  info = new g.InfoWindow()
  if (props.pickable) map.addListener('click', (e) => emit('pick', [Number(e.latLng.lat().toFixed(6)), Number(e.latLng.lng().toFixed(6))]))
  drawAreas(); drawMarkers(); drawUser(); drawPicked()
})
onBeforeUnmount(() => { markers.forEach(m => m.setMap(null)); areaShapes.forEach(a => a.setMap(null)); userMarker?.setMap(null); circle?.setMap(null); pickMarker?.setMap(null); if (g && map) g.event.clearInstanceListeners(map); map = null })
watch(() => props.markers, drawMarkers, { deep: true })
watch(() => props.areas, drawAreas, { deep: true })
watch(() => [props.userPoint, props.radiusKm], drawUser, { deep: true })
watch(() => props.picked, drawPicked, { deep: true })
watch(() => props.center?.join(','), () => { if (map && props.center) map.setCenter(ll(props.center)) })
defineExpose({ focus: (lat, lon, z = 16) => { if (map) { map.setCenter(ll([lat, lon])); map.setZoom(z) } } })
</script>

<template>
  <div class="map-wrap"><div ref="el" class="map-canvas" :style="{ height }" role="application" aria-label="Mapa interactivo de talleres (Google Maps)"/></div>
</template>

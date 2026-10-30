<script setup>
// Proveedor Leaflet + teselas de OpenStreetMap: gratuito y sin API key (respaldo de MapView.vue).
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { money } from '../lib/state'

const props = defineProps({
  markers: { type: Array, default: () => [] },          // [{ id, lat, lon, title, district, price, available }]
  center: { type: Array, default: () => [-12.135, -77.025] },
  zoom: { type: Number, default: 14 },
  userPoint: { type: Array, default: null },            // [lat, lon] punto de referencia del usuario
  radiusKm: { type: Number, default: 0 },
  pickable: { type: Boolean, default: false },          // permite marcar un punto (editor y "cerca de mí")
  picked: { type: Array, default: null },
  height: { type: String, default: '420px' },
  fit: { type: Boolean, default: true },
  areas: { type: Object, default: null },                // { Miraflores: [[lat,lon],...], Barranco: [...] } contornos de distrito
})
const emit = defineEmits(['pick'])
const router = useRouter()
const el = ref(null)
let map, markerLayer, userLayer, pickLayer, areaLayer, lastFit = ''

const pin = (cls) => L.divIcon({ className: `hb-pin ${cls}`, html: '<span></span>', iconSize: [28, 28], iconAnchor: [14, 28], popupAnchor: [0, -26] })
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

function drawAreas() {
  if (!map) return
  areaLayer.clearLayers()
  for (const [name, poly] of Object.entries(props.areas || {}))
    L.polygon(poly, { color: '#3f7d4e', weight: 2, dashArray: '6 6', fillOpacity: 0.04, interactive: false }).bindTooltip(name, { permanent: false }).addTo(areaLayer)
}
function drawMarkers() {
  if (!map) return
  markerLayer.clearLayers()
  const points = []
  for (const m of props.markers) {
    if (!Number.isFinite(m.lat) || !Number.isFinite(m.lon)) continue
    points.push([m.lat, m.lon])
    const popup = document.createElement('div')
    popup.className = 'hb-popup'
    popup.innerHTML = `<b>${esc(m.title)}</b><span>${esc(m.venue || '')}</span><span>${esc(m.district)} · ${money(m.price)}${m.distanceKm != null ? ` · ${m.distanceKm} km` : ''}</span><span>${m.available > 0 ? `${m.available} cupos` : 'Sin cupos'}</span>`
    if (m.id) {
      const link = document.createElement('button')
      link.type = 'button'; link.className = 'hb-popup-link'; link.textContent = 'Ver taller →'
      link.onclick = () => router.push(`/taller/${m.id}`)
      popup.appendChild(link)
    }
    L.marker([m.lat, m.lon], { icon: pin(m.available > 0 ? '' : 'off'), title: m.title }).bindPopup(popup).addTo(markerLayer)
  }
  // Solo se reencuadra si cambian las coordenadas (no en cada redibujado, p. ej. tras reservar).
  const key = points.map(p => p.join(',')).join('|')
  if (key === lastFit) return
  lastFit = key
  if (props.fit && points.length > 1) map.fitBounds(points, { padding: [30, 30], maxZoom: 16, animate: false })
  else if (props.fit && points.length === 1 && !props.userPoint) map.setView(points[0], 16, { animate: false })
}
function drawUser() {
  if (!map) return
  userLayer.clearLayers()
  if (!props.userPoint) return
  L.marker(props.userPoint, { icon: pin('me'), title: 'Tu ubicación de referencia' }).bindTooltip('Tú').addTo(userLayer)
  if (props.radiusKm > 0) {
    const circle = L.circle(props.userPoint, { radius: props.radiusKm * 1000, color: '#c65c38', weight: 2, fillOpacity: 0.06 }).addTo(userLayer)
    map.fitBounds(circle.getBounds(), { padding: [20, 20], animate: false })
  }
}
function drawPicked() {
  if (!map) return
  pickLayer.clearLayers()
  if (props.picked && Number.isFinite(props.picked[0])) L.marker(props.picked, { icon: pin('picked') }).addTo(pickLayer)
}

onMounted(() => {
  map = L.map(el.value, { scrollWheelZoom: false, zoomSnap: 0.5 }).setView(props.center, props.zoom)
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
  }).addTo(map)
  markerLayer = L.layerGroup().addTo(map)
  userLayer = L.layerGroup().addTo(map)
  pickLayer = L.layerGroup().addTo(map)
  areaLayer = L.layerGroup().addTo(map)
  if (props.pickable) map.on('click', (e) => emit('pick', [Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6))]))
  drawAreas(); drawMarkers(); drawUser(); drawPicked()
  if (props.picked && !props.markers.length) map.setView(props.picked, 16, { animate: false })
})
onBeforeUnmount(() => { if (!map) return; map.stop(); map.off(); map.remove(); map = null })
watch(() => props.markers, drawMarkers, { deep: true })
watch(() => [props.userPoint, props.radiusKm], drawUser, { deep: true })
watch(() => props.picked, drawPicked, { deep: true })
watch(() => props.areas, drawAreas, { deep: true })
watch(() => props.center?.join(','), () => { if (map && props.center) map.setView(props.center, map.getZoom(), { animate: false }) })
defineExpose({ focus: (lat, lon, z = 16) => map?.setView([lat, lon], z) })
</script>

<template>
  <div class="map-wrap"><div ref="el" class="map-canvas" :style="{ height }" role="application" aria-label="Mapa interactivo de talleres"/></div>
</template>

<style>
.map-wrap{border-radius:18px;overflow:hidden;border:1px solid #ead8c4;background:#f3ebe1}
.map-canvas{width:100%;z-index:0}
.hb-pin span{display:block;width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#c65c38;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)}
.hb-pin.off span{background:#9b8f84}
.hb-pin.me span{background:#2f6fb0;border-radius:50%;transform:none}
.hb-pin.picked span{background:#3f7d4e}
.hb-popup{display:grid;gap:3px;min-width:170px;font-family:inherit}
.hb-popup span{color:#6b5a4c;font-size:13px}
.hb-popup-link{margin-top:6px;border:0;background:#c65c38;color:#fff;border-radius:8px;padding:6px 8px;cursor:pointer;font-weight:600}
</style>

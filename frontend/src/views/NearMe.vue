<script setup>
import { ref, computed, onMounted } from 'vue'
import { LocateFixed, MapPin, Hand, Info } from 'lucide-vue-next'
import MapView from '../components/MapView.vue'
import WorkshopGrid from '../components/WorkshopGrid.vue'
import { state, notify, authRequest } from '../lib/state'
// "Buscar talleres cerca de mí": el usuario elige su punto (GPS, toque en el mapa o centro de su distrito)
// y Hobbiz calcula la distancia real hasta las coordenadas de cada taller. Las coordenadas del usuario no se guardan.
const point=ref(null),source=ref(''),radiusKm=ref(2),items=ref([]),loading=ref(false),locating=ref(false)
const sourceText=computed(()=>({gps:'tu ubicación GPS',mapa:'el punto que marcaste en el mapa',distrito:`el centro de ${state.user?.preferences?.district||'Miraflores'}`})[source.value]||'')
async function search(){if(!point.value)return;try{loading.value=true;const [lat,lon]=point.value;items.value=(await authRequest(`/workshops?lat=${lat}&lon=${lon}&radiusKm=${radiusKm.value}`)).items}catch(e){notify(e.message)}finally{loading.value=false}}
function setPoint(p,src){point.value=p;source.value=src;search()}
function useGps(){
  if(!navigator.geolocation){notify('Este navegador no ofrece geolocalización. Marca tu punto en el mapa.');return}
  locating.value=true
  navigator.geolocation.getCurrentPosition(({coords})=>{locating.value=false;setPoint([Number(coords.latitude.toFixed(5)),Number(coords.longitude.toFixed(5))],'gps')},
    ()=>{locating.value=false;notify('No pudimos obtener tu ubicación. Toca el mapa para elegir un punto.')},{enableHighAccuracy:true,timeout:10000,maximumAge:60000})
}
function useDistrict(){const d=state.user?.preferences?.district||'Miraflores';setPoint(state.meta.districtCenters[d]||[-12.1211,-77.0297],'distrito')}
onMounted(useDistrict)
</script>
<template>
  <div class="page near-page"><div class="page-heading"><div><div class="eyebrow earth">CERCA DE MÍ</div><h1>Talleres cerca de ti</h1><p class="muted">Usa tu GPS o toca el mapa para elegir un punto; te mostramos los talleres dentro del radio elegido.</p></div></div>
    <div class="near-controls"><button class="btn primary" :disabled="locating" @click="useGps"><LocateFixed :size="18"/> {{locating?'Ubicando...':'Usar mi ubicación (GPS)'}}</button><button class="btn light" @click="useDistrict"><MapPin :size="18"/> Centro de mi distrito</button><span class="muted small"><Hand :size="15"/> o toca cualquier punto del mapa</span>
      <label class="inline-label">Radio<select v-model.number="radiusKm" @change="search"><option :value="0.5">500 m</option><option :value="1">1 km</option><option :value="2">2 km</option><option :value="3">3 km</option><option :value="5">5 km</option></select></label></div>
    <MapView :markers="items" :user-point="point" :radius-km="radiusKm" :areas="state.meta.districtAreas" :pickable="true" :fit="false" height="440px" @pick="p=>setPoint(p,'mapa')"/>
    <p class="small muted near-note"><Info :size="14"/> Distancias en línea recta desde {{sourceText}}. Tu ubicación solo se usa en esta búsqueda y no se almacena. Mapa: OpenStreetMap.</p>
    <div class="list-intro">{{loading?'Buscando...':`${items.length} talleres a menos de ${radiusKm} km`}}</div>
    <WorkshopGrid :items="items" :show-capacity="true" :show-distance="true"/>
    <div v-if="!loading && !items.length" class="empty"><h3>No hay talleres en este radio</h3><p>Amplía el radio o mueve el punto hacia Miraflores o Barranco.</p></div>
  </div>
</template>
<style scoped>.near-controls{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin:8px 0 16px}.near-controls .muted{display:inline-flex;gap:5px;align-items:center}.near-note{display:flex;gap:6px;align-items:center;margin:10px 0}</style>

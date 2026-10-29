<script setup>
import { ref, reactive, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { Search, SlidersHorizontal, MapPin, X, LocateFixed } from 'lucide-vue-next'
import WorkshopGrid from '../components/WorkshopGrid.vue'
import { request } from '../lib/api'
import { state, notify } from '../lib/state'
const route=useRoute()
const filters = reactive({
  q: String(route.query.q || ''),
  category: String(route.query.category || ''),
  district: '',
  maxPrice: '',
  day: '',
  startsAfter: '',
  endsBefore: '',
  near: String(route.query.near || ''),
  lat: '',  
  lon: '',
  radiusKm: 8
});
const expanded=ref(true),loading=ref(false),items=ref([])
async function search(){try{loading.value=true;const params=new URLSearchParams();for(const [key,v] of Object.entries(filters))if(v!==''&&v!==null)params.set(key,v);const res=await request(`/workshops?${params}`);items.value=res.items}catch(e){notify(e.message)}finally{loading.value=false}}
function reset() {
  Object.assign(filters, {
    q: '',
    category: '',
    district: '',
    maxPrice: '',
    day: '',
    startsAfter: '',
    endsBefore: '',
    near: '',
    lat: '',
    lon: '',
    radiusKm: 8
  });

  search();
}
function nearMe(){filters.near=state.user?.preferences?.district||'Miraflores';filters.lat='';filters.lon='';filters.district='';search()}
function useGps(){
  if(!navigator.geolocation){notify('Este navegador no ofrece geolocalización. Selecciona un distrito.');return}
  navigator.geolocation.getCurrentPosition(({coords})=>{
    filters.lat=String(coords.latitude);filters.lon=String(coords.longitude)
    filters.near='';filters.district='';search()
  },()=>notify('No pudimos obtener tu ubicación. Puedes seleccionar un distrito.'),{enableHighAccuracy:false,timeout:8000,maximumAge:60000})
}
onMounted(search)
</script>
<template>
 <div class="page explore-page"><div class="page-heading"><div><div class="eyebrow earth">EXPLORAR</div><h1>Encuentra tu próximo taller</h1><p class="muted">Compara opciones por precio, zona, horario e intereses.</p></div><button class="btn outline" @click="expanded=!expanded"><SlidersHorizontal :size="17"/> {{expanded?'Ocultar filtros':'Mostrar filtros'}}</button></div>
  <div class="search-line"><label class="searchbox"><Search :size="21"/><input v-model="filters.q" type="search" placeholder="Cerámica, pintura, cocina..." aria-label="Buscar por nombre" @keyup.enter="search" /></label><button class="btn primary" @click="search">Buscar</button></div>
  <section v-if="expanded" class="filter-panel">
    <div class="filter-grid"><label> Categoría <select v-model="filters.category"><option value="">Todas las categorías</option><option v-for="c in state.meta.categories" :key="c">{{c}}</option></select></label>
    <label>Distrito <select v-model="filters.district" @change="filters.near='';filters.lat='';filters.lon='' "><option value="">Todos los distritos</option><option v-for="d in state.meta.districts" :key="d">{{d}}</option></select></label>
    <label>Precio máximo (S/) <input v-model="filters.maxPrice" type="number" min="0" max="9999" placeholder="Sin límite"/></label>
    <label>
      Empieza desde
      <input v-model="filters.startsAfter" type="time" />
    </label>

    <label>
      Termina hasta
      <input v-model="filters.endsBefore" type="time" />
    </label>
    <label>Día <select v-model="filters.day"><option value="">Cualquier día</option><option value="sábado">Sábado</option><option value="domingo">Domingo</option><option value="lunes">Lunes</option><option value="martes">Martes</option><option value="miércoles">Miércoles</option><option value="jueves">Jueves</option><option value="viernes">Viernes</option></select></label></div>
    <div class="nearby-filter"><button class="btn light" @click="nearMe"><MapPin :size="18"/> Cerca de mi distrito</button><button class="btn outline" @click="useGps"><LocateFixed :size="18"/> Usar mi ubicación (GPS)</button><label class="inline-label">Zona de referencia<select v-model="filters.near" @change="filters.district='';filters.lat='';filters.lon='' "><option value="">Sin búsqueda por cercanía</option><option v-for="d in state.meta.districts" :key="d">{{d}}</option></select></label><label class="inline-label">Radio<select v-model.number="filters.radiusKm"><option :value="3">3 km</option><option :value="5">5 km</option><option :value="8">8 km</option><option :value="15">15 km</option><option :value="25">25 km</option></select></label></div>
    <p class="small muted"> La cercanía usa la ubicación del local cuando está registrada. Si falta, usa el centro de su distrito como referencia. Las distancias son en línea recta, no tiempos de viaje. Puedes seleccionar un distrito o compartir tu ubicación GPS. </p>   
    <div class="filter-actions"><button class="btn ghost" @click="reset"><X :size="16"/> Limpiar</button><button class="btn primary" @click="search">Aplicar filtros</button></div>
  </section>
  <div class="list-intro">{{loading?'Buscando...':`${items.length} resultados encontrados`}}</div>
  <WorkshopGrid :items="items" :show-capacity="true"/>
  <div v-if="!loading && !items.length" class="empty"><Search :size="30"/><h3>No encontramos talleres con estos filtros</h3><p>Prueba con otro distrito, un presupuesto mayor o sin limitar la categoría.</p><button class="btn primary" @click="reset">Ver todos los talleres</button></div>
 </div>
</template>

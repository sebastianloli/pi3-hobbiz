<script setup>
import { ref, reactive, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { Search, SlidersHorizontal, MapPin, X, LocateFixed } from 'lucide-vue-next'
import WorkshopGrid from '../components/WorkshopGrid.vue'
import { request } from '../lib/api'
import { state, notify } from '../lib/state'
const route=useRoute()
const filters=reactive({q:String(route.query.q||''),category:String(route.query.category||''),district:'',maxPrice:'',day:'',near:String(route.query.near||''),radiusKm:8})
const expanded=ref(true),loading=ref(false),items=ref([])
async function search(){try{loading.value=true;const params=new URLSearchParams();for(const [key,v] of Object.entries(filters))if(v!==''&&v!==null)params.set(key,v);const res=await request(`/workshops?${params}`);items.value=res.items}catch(e){notify(e.message)}finally{loading.value=false}}
function reset(){Object.assign(filters,{q:'',category:'',district:'',maxPrice:'',day:'',near:'',radiusKm:8});search()}
function nearMe(){filters.near=state.user?.preferences?.district||'Miraflores';filters.district='';search()}
onMounted(search)
</script>
<template>
 <div class="page explore-page"><div class="page-heading"><div><div class="eyebrow earth">EXPLORAR</div><h1>Encuentra tu próximo taller</h1><p class="muted">Compara opciones por precio, zona, horario e intereses.</p></div><button class="btn outline" @click="expanded=!expanded"><SlidersHorizontal :size="17"/> {{expanded?'Ocultar filtros':'Mostrar filtros'}}</button></div>
  <div class="search-line"><label class="searchbox"><Search :size="21"/><input v-model="filters.q" type="search" placeholder="Cerámica, pintura, cocina..." aria-label="Buscar por nombre" @keyup.enter="search" /></label><button class="btn primary" @click="search">Buscar</button></div>
  <section v-if="expanded" class="filter-panel">
    <div class="filter-grid"><label> Categoría <select v-model="filters.category"><option value="">Todas las categorías</option><option v-for="c in state.meta.categories" :key="c">{{c}}</option></select></label>
    <label>Distrito <select v-model="filters.district" @change="filters.near='' "><option value="">Todos los distritos</option><option v-for="d in state.meta.districts" :key="d">{{d}}</option></select></label>
    <label>Precio máximo (S/) <input v-model="filters.maxPrice" type="number" min="0" max="9999" placeholder="Sin límite"/></label>
    <label>Día <select v-model="filters.day"><option value="">Cualquier día</option><option value="sábado">Sábado</option><option value="domingo">Domingo</option><option value="lunes">Lunes</option><option value="martes">Martes</option><option value="miércoles">Miércoles</option><option value="jueves">Jueves</option><option value="viernes">Viernes</option></select></label></div>
    <div class="nearby-filter"><button class="btn light" @click="nearMe"><LocateFixed :size="18"/> Buscar talleres cerca de mí</button><label class="inline-label">Zona de referencia<select v-model="filters.near" @change="filters.district='' "><option value="">Sin búsqueda por cercanía</option><option v-for="d in state.meta.districts" :key="d">{{d}}</option></select></label><label class="inline-label">Radio<select v-model.number="filters.radiusKm"><option :value="3">3 km</option><option :value="5">5 km</option><option :value="8">8 km</option><option :value="15">15 km</option><option :value="25">25 km</option></select></label></div>
    <p class="small muted">La cercanía se calcula aproximadamente desde el centro del distrito seleccionado; no utiliza GPS ni requiere Google Maps.</p>
    <div class="filter-actions"><button class="btn ghost" @click="reset"><X :size="16"/> Limpiar</button><button class="btn primary" @click="search">Aplicar filtros</button></div>
  </section>
  <div class="list-intro">{{loading?'Buscando...':`${items.length} resultados encontrados`}}</div>
  <WorkshopGrid :items="items" :show-capacity="true"/>
  <div v-if="!loading && !items.length" class="empty"><Search :size="30"/><h3>No encontramos talleres con estos filtros</h3><p>Prueba con otro distrito, un presupuesto mayor o sin limitar la categoría.</p><button class="btn primary" @click="reset">Ver todos los talleres</button></div>
 </div>
</template>

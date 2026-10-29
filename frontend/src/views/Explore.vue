<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { Search, SlidersHorizontal, X, Map as MapIcon, LayoutGrid, MapPinned } from 'lucide-vue-next'
import WorkshopGrid from '../components/WorkshopGrid.vue'
import MapView from '../components/MapView.vue'
import { state, notify, authRequest } from '../lib/state'
const route=useRoute()
const blank={q:'',category:'',district:'',maxPrice:'',day:'',timeOfDay:'',startsAfter:'',endsBefore:''}
const filters=reactive({...blank,q:String(route.query.q||''),category:String(route.query.category||''),district:String(route.query.district||'')})
const expanded=ref(true),loading=ref(false),items=ref([]),view=ref(route.query.view==='mapa'?'mapa':'lista')
async function search(){try{loading.value=true;const params=new URLSearchParams();for(const [key,v] of Object.entries(filters))if(v!==''&&v!==null)params.set(key,v);items.value=(await authRequest(`/workshops?${params}`)).items}catch(e){notify(e.message)}finally{loading.value=false}}
function reset(){Object.assign(filters,blank);search()}
onMounted(search)
</script>
<template>
 <div class="page explore-page"><div class="page-heading"><div><div class="eyebrow earth">BÚSQUEDA MANUAL</div><h1>Encuentra tu próximo taller</h1><p class="muted">Compara talleres de Miraflores y Barranco por categoría, distrito, precio y horario.</p></div><button class="btn outline" @click="expanded=!expanded"><SlidersHorizontal :size="17"/> {{expanded?'Ocultar filtros':'Mostrar filtros'}}</button></div>
  <div class="search-line"><label class="searchbox"><Search :size="21"/><input v-model="filters.q" type="search" placeholder="Cerámica, guitarra, teatro..." aria-label="Buscar por nombre" @keyup.enter="search" /></label><button class="btn primary" @click="search">Buscar</button></div>
  <section v-if="expanded" class="filter-panel">
    <div class="filter-grid"><label> Categoría <select v-model="filters.category"><option value="">Todas las categorías</option><option v-for="c in state.meta.categories" :key="c">{{c}}</option></select></label>
    <label>Distrito <select v-model="filters.district"><option value="">Miraflores y Barranco</option><option v-for="d in state.meta.districts" :key="d">{{d}}</option></select></label>
    <label>Precio máximo (S/) <input v-model="filters.maxPrice" type="number" min="0" max="9999" placeholder="Sin límite"/></label>
    <label>Día <select v-model="filters.day"><option value="">Cualquier día</option><option v-for="d in ['lunes','martes','miércoles','jueves','viernes','sábado','domingo']" :key="d" :value="d">{{d[0].toUpperCase()+d.slice(1)}}</option></select></label>
    <label>Horario <select v-model="filters.timeOfDay"><option value="">Cualquier hora</option><option value="mañana">Mañana (antes de 12:00)</option><option value="tarde">Tarde (12:00–18:00)</option><option value="noche">Noche (desde 18:00)</option></select></label>
    <label>Empieza desde <input v-model="filters.startsAfter" type="time"/></label>
    <label>Termina hasta <input v-model="filters.endsBefore" type="time"/></label></div>
    <div class="filter-actions"><RouterLink to="/cerca" class="btn light"><MapPinned :size="17"/> ¿Prefieres buscar por cercanía? Ir a Cerca de mí</RouterLink><button class="btn ghost" @click="reset"><X :size="16"/> Limpiar</button><button class="btn primary" @click="search">Aplicar filtros</button></div>
  </section>
  <div class="list-intro between"><span>{{loading?'Buscando...':`${items.length} resultados encontrados`}}</span><div class="view-toggle" role="group" aria-label="Tipo de vista"><button :class="{selected:view==='lista'}" @click="view='lista'"><LayoutGrid :size="16"/> Lista</button><button :class="{selected:view==='mapa'}" @click="view='mapa'"><MapIcon :size="16"/> Mapa</button></div></div>
  <MapView v-if="view==='mapa'" :markers="items" :areas="state.meta.districtAreas" height="460px"/>
  <WorkshopGrid v-else :items="items" :show-capacity="true"/>
  <div v-if="!loading && !items.length" class="empty"><Search :size="30"/><h3>No encontramos talleres con estos filtros</h3><p>Prueba con otro distrito, un presupuesto mayor o sin limitar la categoría u horario.</p><button class="btn primary" @click="reset">Ver todos los talleres</button></div>
 </div>
</template>
<style scoped>.view-toggle{display:inline-flex;border:1px solid #e2cdb7;border-radius:999px;overflow:hidden}.view-toggle button{border:0;background:#fff;padding:7px 14px;display:flex;gap:6px;align-items:center;cursor:pointer;color:#6b5a4c}.view-toggle button.selected{background:#c65c38;color:#fff}.between{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}</style>

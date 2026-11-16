<script setup>
// Directorio de locales de Miraflores y Barranco (los 35 cargados desde talleres.pdf y los talleristas registrados).
import { ref, reactive, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { Search, Store, AtSign, CalendarDays, BadgeCheck } from 'lucide-vue-next'
import { state, notify, authRequest } from '../lib/state'
const filters=reactive({q:'',district:''}),items=ref([]),loading=ref(false)
async function load(){try{loading.value=true;const p=new URLSearchParams(Object.entries(filters).filter(([,v])=>v));items.value=(await authRequest(`/instructors?${p}`)).items}catch(e){notify(e.message)}finally{loading.value=false}}
onMounted(load)
</script>
<template>
  <div class="page locales-page">
    <div class="page-heading"><div><div class="eyebrow earth">DIRECTORIO</div><h1>Locales de talleres</h1><p class="muted">Todos los talleres de Miraflores y Barranco, también los que aún no publican sesiones.</p></div></div>
    <div class="search-line"><label class="searchbox"><Search :size="21"/><input v-model="filters.q" type="search" placeholder="Nombre del local o tipo de taller" aria-label="Buscar locales" @keyup.enter="load"/></label>
      <select v-model="filters.district" class="district-select" aria-label="Distrito" @change="load"><option value="">Miraflores y Barranco</option><option v-for="d in state.meta.districts" :key="d">{{d}}</option></select>
      <button class="btn primary" @click="load">Buscar</button></div>
    <div class="list-intro">{{loading?'Cargando...':`${items.length} locales`}}</div>
    <div class="locales-grid">
      <RouterLink v-for="l in items" :key="l.id" :to="`/estudio/${l.id}`" class="local-card">
        <img v-if="l.coverImage" :src="l.coverImage" :alt="l.name" loading="lazy"/><div v-else class="local-placeholder"><Store :size="34"/></div>
        <div class="local-body">
          <h3>{{l.name}} <BadgeCheck v-if="l.claimed" :size="16" class="claimed" aria-label="Administrado por el taller"/></h3>
          <p class="muted small">{{l.district}}<template v-if="l.categories.length"> · {{l.categories.join(', ')}}</template></p>
          <p v-if="l.tagline" class="small">{{l.tagline}}</p>
          <div class="local-tags">
            <span class="tag" :class="{'tag-muted':!l.workshopCount}"><CalendarDays :size="13"/> {{l.workshopCount?`${l.workshopCount} ${l.workshopCount===1?'sesión':'sesiones'}`:'Sin sesiones publicadas'}}</span>
            <span v-if="!l.verified" class="tag tag-muted">Ficha por completar</span>
            <span v-if="l.instagram" class="tag tag-muted"><AtSign :size="13"/> Instagram</span>
          </div>
        </div>
      </RouterLink>
    </div>
    <div v-if="!loading && !items.length" class="empty"><Store :size="30"/><h3>No encontramos locales</h3><p>Prueba con otro nombre o distrito.</p></div>
  </div>
</template>
<style scoped>
.district-select{border:1px solid #e4d5c1;border-radius:14px;padding:0 12px;background:#fffdf9;min-height:48px}
.locales-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:16px}
.local-card{display:flex;flex-direction:column;background:var(--card);border:1px solid var(--line);border-radius:20px;overflow:hidden;text-decoration:none;color:inherit;box-shadow:var(--shadow)}
.local-card img,.local-placeholder{width:100%;height:140px;object-fit:cover}
.local-placeholder{display:grid;place-items:center;background:#f6e7da;color:#b97a55}
.local-body{padding:14px 16px 16px;display:grid;gap:6px}.local-body h3{margin:0;font-size:1.02rem;display:flex;gap:6px;align-items:center}.local-body p{margin:0}
.claimed{color:#3f7d4e}.local-tags{display:flex;gap:6px;flex-wrap:wrap}.local-tags .tag{display:inline-flex;gap:4px;align-items:center}
@media (max-width:690px){.search-line{flex-wrap:wrap}.district-select{flex:1}}
</style>

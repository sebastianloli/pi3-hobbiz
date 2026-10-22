<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Search, SlidersHorizontal, ArrowRight, Sparkles, MapPin, Map } from 'lucide-vue-next'
import WorkshopGrid from '../components/WorkshopGrid.vue'
import SectionHeading from '../components/SectionHeading.vue'
import { request } from '../lib/api'
import { notify, state } from '../lib/state'
const router=useRouter(),q=ref(''),selectedCategory=ref('Todos'),workshops=ref([]),recommended=ref([]),loading=ref(true)
const categories=['Todos','Arte','Cocina','Oficios','Bienestar','Otros']
async function refresh(){try{loading.value=true;const [a,b]=await Promise.all([request('/workshops'),request('/recommendations')]);workshops.value=a.items;recommended.value=b.items}catch(e){notify(e.message)}finally{loading.value=false}}
onMounted(refresh)
const filtered=()=>selectedCategory.value==='Todos'?workshops.value:workshops.value.filter(w=>w.category===selectedCategory.value)
function search(){router.push({path:'/explorar',query:{q:q.value,category:selectedCategory.value==='Todos'?'':selectedCategory.value}})}
</script>
<template>
  <div class="page home">
    <section class="hero"><div class="eyebrow">TEMPORADA DE OTOÑO · HOBBIZ</div><h1>Aprende algo con tus manos este fin de semana</h1><p>{{workshops.length}} talleres presenciales en Lima, dictados por pequeños talleristas.</p><span class="hero-decoration">✷</span></section>
    <div class="search-line"><label class="searchbox"><Search :size="22"/><input v-model="q" type="search" placeholder="¿Qué quieres aprender?" @keyup.enter="search" aria-label="Buscar talleres" /></label><button class="filter-icon" aria-label="Ir a filtros" @click="router.push('/explorar')"><SlidersHorizontal :size="22"/></button></div>
    <div class="category-chips"><button v-for="cat in categories" :key="cat" class="category-chip" :class="{active:selectedCategory===cat}" @click="selectedCategory=cat">{{cat}}</button></div>
    <div class="quick-links"><button class="link-like" @click="router.push('/explorar?near=Miraflores')"><MapPin :size="17"/> Buscar talleres cerca de mí <ArrowRight :size="16"/></button><span class="muted">Selecciona tu distrito y compara opciones próximas</span></div>
    <div class="list-intro muted">{{filtered().length}} talleres disponibles en Lima</div>
    <div v-if="loading" class="loading-area">Cargando talleres...</div>
    <WorkshopGrid v-else :items="filtered().slice(0,6)"/>
    <div v-if="!loading && !filtered().length" class="empty">No hay talleres en esta categoría por ahora.</div>
    <div class="section-space"/>
    <SectionHeading title="Nuevos talleres para descubrir" subtitle="Propuestas recientes de pequeños emprendimientos" to="/explorar"/>
    <WorkshopGrid :items="workshops.filter(w=>w.reviewCount===0).slice(0,3)"/>
    <div class="section-space"/>
    <SectionHeading title="Sugerencias para ti" subtitle="Según tus intereses y preferencias de tu perfil" to="/perfil" linkText="Editar preferencias"/>
    <WorkshopGrid :items="recommended.slice(0,3)"/>
    <div class="info-banner"><div class="info-icon"><Sparkles :size="28"/></div><div><h3>¿Tienes un taller propio?</h3><p>Organiza tus publicaciones, horarios y registros desde Hobbiz Tallerista.</p></div><button class="btn secondary" @click="$router.push('/tallerista')">Ver cómo funciona <ArrowRight :size="16"/></button></div>
  </div>
</template>

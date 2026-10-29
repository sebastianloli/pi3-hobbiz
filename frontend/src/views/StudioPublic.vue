<script setup>
import {onMounted,ref,computed} from 'vue'
import {useRoute,useRouter} from 'vue-router'
import {ArrowLeft,MapPin,Star} from 'lucide-vue-next'
import WorkshopGrid from '../components/WorkshopGrid.vue'
import MapView from '../components/MapView.vue'
import {authRequest,notify,state} from '../lib/state'
import {fontStacks,linkNames,studioColor} from '../lib/studio'
const route=useRoute(),router=useRouter(),item=ref(null)
onMounted(async()=>{try{item.value=(await authRequest(`/instructors/${route.params.id}`)).item}catch(e){notify(e.message)}})
const s=computed(()=>item.value?.studio||{}),color=computed(()=>studioColor(s.value))
</script>
<template><div class="page studio-public"><button class="back-link" @click="router.back()"><ArrowLeft :size="18"/> Volver</button>
<div v-if="!item" class="loading-area">Cargando perfil...</div>
<article v-else :class="`layout-${s.layout||'portada'}`" :style="{fontFamily:fontStacks[s.font]||'inherit','--studio':color}">
  <header class="studio-hero" :style="{background:s.coverImage&&s.layout!=='compacta'?`linear-gradient(0deg,rgba(0,0,0,.55),rgba(0,0,0,.1)),url('${s.coverImage}') center/cover`:color}"><h1>{{s.displayName||item.name}}</h1><p v-if="s.tagline">{{s.tagline}}</p><p class="hero-meta"><span v-if="s.district"><MapPin :size="15"/> {{s.address&&!s.address.toLowerCase().includes(s.district.toLowerCase())?`${s.address}, `:s.address?'':''}}{{s.address&&s.address.toLowerCase().includes(s.district.toLowerCase())?s.address:s.district}}</span><span v-if="item.averageRating"><Star :size="15" fill="currentColor"/> {{item.averageRating}}</span><span>{{item.workshopCount}} taller(es)</span></p></header>
  <div v-if="s.gallery?.length" class="studio-gallery"><img v-for="g in s.gallery" :key="g" :src="g" :alt="`Galería de ${s.displayName||item.name}`" loading="lazy"/></div>
  <section class="text-section"><h2 :style="{color}">Sobre nosotros</h2><p>{{s.bio||'Este tallerista aún no agrega una descripción.'}}</p><div class="studio-links"><a v-for="(url,k) in s.links||{}" :key="k" :href="url" target="_blank" rel="noopener noreferrer" class="tag" :style="{background:color,color:'#fff'}">{{linkNames[k]}} ↗</a></div></section>
  <p v-if="item.claimed===false" class="card-note small">Ficha informativa creada por Hobbiz a partir de información pública; este taller aún no administra su perfil.</p>
  <section class="text-section"><h2 :style="{color}">Talleres disponibles</h2><WorkshopGrid :items="item.workshops" :show-capacity="true"/><div v-if="!item.workshops.length" class="empty compact">No hay talleres publicados por ahora.</div></section>
  <section class="text-section"><h2 :style="{color}">Reseñas</h2><div v-if="!item.reviews?.length" class="card-note">Aún no hay reseñas.</div><article v-for="r in item.reviews" :key="r.id" class="review-card"><div><b>{{r.name}}</b> · <small class="muted">{{r.workshopTitle}}</small> <span class="rating-review">{{'★'.repeat(r.stars)}}{{'☆'.repeat(5-r.stars)}}</span></div><p>{{r.comment}}</p></article></section>
  <section v-if="item.workshops.length" class="text-section"><h2 :style="{color}">Dónde encontrarnos</h2><MapView :markers="item.workshops" height="300px"/></section>
</article></div></template>
<style scoped>.studio-hero{border-radius:22px;padding:56px 28px 26px;color:#fff;margin:10px 0 18px}.layout-compacta .studio-hero{padding:26px}.studio-hero h1{margin:0;font-size:2.2rem}.hero-meta{display:flex;gap:16px;flex-wrap:wrap;opacity:.95}.hero-meta span{display:inline-flex;gap:5px;align-items:center}.studio-gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-bottom:18px}.studio-gallery img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:14px}.layout-galeria{display:flex;flex-direction:column}.layout-galeria .studio-gallery{order:-1;margin-top:10px}.studio-links{display:flex;gap:8px;flex-wrap:wrap}.studio-links a{text-decoration:none}</style>

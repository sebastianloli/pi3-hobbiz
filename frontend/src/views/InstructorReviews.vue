<script setup>
import { onMounted, ref, computed } from 'vue'
import { Star } from 'lucide-vue-next'
import OwnerTabs from '../components/OwnerTabs.vue'
import { ensureInstructor } from '../lib/instructor'
import { authRequest, notify } from '../lib/state'
const reviews=ref([])
async function load(){try{await ensureInstructor();reviews.value=(await authRequest('/instructor/reviews')).items}catch(e){notify(e.message)}}
onMounted(load)
const avg=computed(()=>reviews.value.length?(reviews.value.reduce((s,r)=>s+r.stars,0)/reviews.value.length).toFixed(1):'—')
</script>
<template><div class="page owner-page"><div class="page-heading"><div><div class="eyebrow earth">OPINIONES DE CLIENTES</div><h1>Reseñas de tus talleres</h1><p class="muted">Consulta qué valoran tus participantes y cómo mejorar las próximas sesiones.</p></div><div class="rating-large"><Star fill="currentColor"/> {{avg}}</div></div><OwnerTabs/><section class="form-card"><h2>{{reviews.length}} valoraciones recibidas</h2><div class="review-list"><article v-for="r in reviews" :key="r.id" class="review-card"><div><strong>{{r.name}}</strong><span class="rating-review">{{'★'.repeat(r.stars)}}{{'☆'.repeat(5-r.stars)}}</span></div><p>{{r.comment}}</p><small class="muted">{{r.workshopTitle}}</small></article></div><div v-if="!reviews.length" class="empty compact">Todavía no tienes reseñas registradas.</div></section></div></template>

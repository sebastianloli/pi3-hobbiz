<script setup>
import { onMounted, ref } from 'vue'
import { Bookmark } from 'lucide-vue-next'
import WorkshopGrid from '../components/WorkshopGrid.vue'
import { authRequest,notify } from '../lib/state'
const items=ref([])
async function reload(){try{items.value=(await authRequest('/me/favorites')).items}catch(e){notify(e.message)}}
onMounted(reload)
</script>
<template><div class="page"><div class="page-heading"><div><div class="eyebrow earth">TUS FAVORITOS</div><h1>Talleres guardados</h1><p class="muted">Vuelve a encontrar las experiencias que más te interesan.</p></div></div><WorkshopGrid v-if="items.length" :items="items" @favorite-changed="reload"/><div v-else class="empty"><Bookmark :size="42"/><h3>Tu lista está esperando nuevos talleres</h3><p>Guarda talleres desde Inicio o Explorar con el ícono de marcador.</p><RouterLink to="/explorar" class="btn primary">Explorar talleres</RouterLink></div></div></template>

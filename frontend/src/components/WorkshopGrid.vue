<script setup>
import { ref, onMounted, watch } from 'vue'
import { request } from '../lib/api'
import { state, authRequest, notify } from '../lib/state'
import WorkshopCard from './WorkshopCard.vue'
const props=defineProps({ items:{type:Array,default:()=>[]}, showCapacity:{type:Boolean,default:false} })
const favoriteIds=ref([])
const emit=defineEmits(['favorite-changed'])
async function refresh(){
  try { const r=await authRequest('/me/favorites');favoriteIds.value=r.items.map(w=>w.id) }catch { favoriteIds.value=[] }
}
onMounted(refresh)
watch(()=>state.user?.id,refresh)
</script>
<template>
  <div class="workshop-grid"><WorkshopCard v-for="w in items" :key="w.id" :workshop="w" :favorite="favoriteIds.includes(w.id)" :show-capacity="showCapacity" @favorite-changed="(id)=>{ refresh(); emit('favorite-changed',id) }" /></div>
</template>

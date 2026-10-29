<script setup>
import { onMounted } from 'vue'
import { state, refreshFavorites } from '../lib/state'
import WorkshopCard from './WorkshopCard.vue'
const props=defineProps({ items:{type:Array,default:()=>[]}, showCapacity:{type:Boolean,default:false}, showDistance:{type:Boolean,default:false} })
const emit=defineEmits(['favorite-changed'])
onMounted(()=>{ if(state.user?.role==='client' && !state.favoriteIds.length) refreshFavorites() })
</script>
<template>
  <div class="workshop-grid"><WorkshopCard v-for="w in items" :key="w.id" :workshop="w" :favorite="state.favoriteIds.includes(w.id)" :show-capacity="showCapacity" :show-distance="showDistance" @favorite-changed="(id)=>emit('favorite-changed',id)" /></div>
</template>

<script setup>
import { useRoute } from 'vue-router'
import { ChartNoAxesColumn, CalendarDays, PlusCircle, Star, UsersRound } from 'lucide-vue-next'
const route=useRoute()
const tabs=[{path:'/tallerista',name:'Resumen',icon:ChartNoAxesColumn},{path:'/tallerista/talleres',name:'Mis talleres',icon:CalendarDays},{path:'/tallerista/publicar',name:'Crear taller',icon:PlusCircle},{path:'/tallerista/inscritos',name:'Inscritos',icon:UsersRound},{path:'/tallerista/resenas',name:'Reseñas',icon:Star}]
</script>
<template><div class="owner-tabs"><RouterLink v-for="t in tabs" :key="t.path" :to="t.path" :class="{active:route.path===t.path}"><component :is="t.icon" :size="18"/> {{t.name}}</RouterLink></div></template>

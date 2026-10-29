<script setup>
import { computed } from 'vue'
import { useRouter, useRoute, RouterLink, RouterView } from 'vue-router'
import { Palette, GraduationCap, BookOpenText, House, Search, Bookmark, UserRound, LayoutDashboard, CalendarDays, NotebookPen, UsersRound, LogOut, MapPinned, MessageSquareText } from 'lucide-vue-next'
import { state, notify, logout, homeFor } from './lib/state'
const router=useRouter(),route=useRoute()
const role=computed(()=>state.user?.role||'client')
const navClient=[{to:'/',title:'Inicio',icon:House},{to:'/explorar',title:'Explorar',icon:Search},{to:'/cerca',title:'Cerca de mí',icon:MapPinned},{to:'/guardados',title:'Guardados',icon:Bookmark},{to:'/perfil',title:'Perfil',icon:UserRound}]
const navOwner=[{to:'/tallerista',title:'Resumen',icon:LayoutDashboard},{to:'/tallerista/talleres',title:'Mis talleres',icon:CalendarDays},{to:'/tallerista/publicar',title:'Crear taller',icon:NotebookPen},{to:'/tallerista/inscritos',title:'Inscritos',icon:UsersRound}]
const active=(target)=>route.path===target||target==='/tallerista/talleres' && route.path.includes('/tallerista/editar')
async function signOut(){try{await logout();notify('Sesión cerrada.');router.push('/cuenta')}catch(e){notify(e.message)}}
</script>
<template>
  <div id="layout">
    <header class="topbar">
      <div class="topbar-inner shell">
        <RouterLink class="brand" :to="state.user?homeFor(state.user):'/cuenta'" aria-label="Hobbiz, inicio">
          <span class="brand-mark"><Palette :size="23"/></span>
          <span><strong>Hobbiz</strong><small>Talleres en Miraflores y Barranco</small></span>
        </RouterLink>
        <div v-if="state.user" class="top-actions">
          <span class="top-pill role-pill" :title="`Sesión iniciada como ${state.user.email}`"><component :is="role==='client'?GraduationCap:Palette" :size="17"/><span>{{role==='client'?'Cliente':'Tallerista'}}</span></span>
          <RouterLink class="top-pill" to="/cuenta" title="Mi cuenta" aria-label="Mi cuenta"><UserRound :size="18"/><span>Mi cuenta</span></RouterLink><RouterLink class="top-pill" to="/guia" title="Guía de flujo" aria-label="Guía de flujo"><BookOpenText :size="18"/><span>Guía de flujo</span></RouterLink><RouterLink class="top-pill" to="/opinion" title="Danos tu opinión" aria-label="Danos tu opinión"><MessageSquareText :size="18"/><span>Opinión</span></RouterLink>
          <button class="round-icon" title="Cerrar sesión" aria-label="Cerrar sesión" @click="signOut"><LogOut :size="18"/></button>
        </div>
      </div>
    </header>
    <main class="shell main-area">
      <div v-if="!state.ready" class="loading-area"><div class="spinner"/> Preparando Hobbiz...</div>
      <RouterView v-else v-slot="{ Component }"><component :is="Component" :key="route.fullPath" /></RouterView>
    </main>
    <nav v-if="state.user" class="bottom-nav" aria-label="Navegación principal"><div class="bottom-inner shell"><RouterLink v-for="item in role==='client'?navClient:navOwner" :key="item.to" :to="item.to" :class="{active:active(item.to)}"><component :is="item.icon" :size="22" :stroke-width="active(item.to)?2.4:1.9"/><span>{{item.title}}</span></RouterLink></div></nav>
    <transition name="fade"><div v-if="state.toast" class="toast" role="status">{{state.toast}}</div></transition>
  </div>
</template>

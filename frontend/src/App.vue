<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter, useRoute, RouterLink, RouterView } from 'vue-router'
import { Palette, GraduationCap, Bell, BookOpenText, House, Search, Bookmark, UserRound, LayoutDashboard, CalendarDays, NotebookPen, UsersRound, MessageCircle, LogOut } from 'lucide-vue-next'
import { state, initialize, demoLogin, notify, logout } from './lib/state'
const router=useRouter(),route=useRoute()
const role=computed(()=>state.user?.role||'client')
const switching=ref(false)
const navClient=[{to:'/',title:'Inicio',icon:House},{to:'/explorar',title:'Explorar',icon:Search},{to:'/guardados',title:'Guardados',icon:Bookmark},{to:'/perfil',title:'Perfil',icon:UserRound}]
const navOwner=[{to:'/tallerista',title:'Resumen',icon:LayoutDashboard},{to:'/tallerista/talleres',title:'Mis talleres',icon:CalendarDays},{to:'/tallerista/publicar',title:'Crear taller',icon:NotebookPen},{to:'/tallerista/inscritos',title:'Inscritos',icon:UsersRound}]
const active=(target)=>route.path===target||target==='/tallerista/talleres' && route.path.includes('/tallerista/editar')
async function changeRole(next){
  if(switching.value||role.value===next) return
  try{switching.value=true; if(state.mode==='firebase-mongo'){await router.push('/cuenta');notify('Para cambiar de rol, inicia sesión con una cuenta del tipo correspondiente.')}else{await demoLogin(next);await router.push(next==='client'?'/':'/tallerista');notify(next==='client'?'Vista de cliente activada':'Vista de tallerista activada')}}
  catch(e){notify(e.message)} finally{ switching.value=false }
}
async function resetDemo(){try {await logout();if(state.mode==='demo')await demoLogin(role.value);notify('Sesión cerrada.')}catch(e){notify(e.message)}}
onMounted(initialize)
</script>
<template>
  <div id="layout">
    <header class="topbar">
      <div class="topbar-inner shell">
        <RouterLink class="brand" :to="role==='client'?'/':'/tallerista'" aria-label="Hobbiz, inicio">
          <span class="brand-mark"><Palette :size="23"/></span>
          <span><strong>Hobbiz</strong><small>Talleres en Lima</small></span>
        </RouterLink>
        <div class="top-actions">
          <div class="role-toggle" aria-label="Modo de uso"><button :disabled="switching" :class="{selected:role==='client'}" @click="changeRole('client')"><GraduationCap :size="17"/> <span>Cliente</span></button><button :disabled="switching" :class="{selected:role==='instructor'}" @click="changeRole('instructor')"><Palette :size="17"/> <span>Tallerista</span></button></div>
          <RouterLink class="top-pill" to="/cuenta"><UserRound :size="18"/><span>{{state.user ? 'Mi cuenta':'Ingresar'}}</span></RouterLink><RouterLink class="top-pill" to="/guia"><BookOpenText :size="18"/><span>Guía de flujo</span></RouterLink>
          <button class="round-icon" title="Notificaciones: fuera del alcance de esta versión" aria-label="Información sobre notificaciones" @click="notify('Las notificaciones push están fuera del alcance de esta versión.')"><Bell :size="18"/></button>
        </div>
      </div>
    </header>
    <main class="shell main-area">
      <div v-if="!state.ready" class="loading-area"><div class="spinner"/> Preparando Hobbiz...</div>
      <RouterView v-else v-slot="{ Component }"><component :is="Component" :key="route.fullPath" /></RouterView>
    </main>
    <nav class="bottom-nav" aria-label="Navegación principal"><div class="bottom-inner shell"><RouterLink v-for="item in role==='client'?navClient:navOwner" :key="item.to" :to="item.to" :class="{active:active(item.to)}"><component :is="item.icon" :size="22" :stroke-width="active(item.to)?2.4:1.9"/><span>{{item.title}}</span></RouterLink></div></nav>
    <transition name="fade"><div v-if="state.toast" class="toast" role="status">{{state.toast}}</div></transition>
  </div>
</template>

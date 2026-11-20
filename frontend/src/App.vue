<script setup>
import { computed } from 'vue'
import { useRouter, useRoute, RouterLink, RouterView } from 'vue-router'
import { Palette, GraduationCap, BookOpenText, House, Search, Bookmark, UserRound, LayoutDashboard, CalendarDays, NotebookPen, UsersRound, LogOut, MapPinned, MessageSquareText, ShieldCheck, MailWarning } from 'lucide-vue-next'
import { state, notify, logout, homeFor, resendVerification, refreshVerification } from './lib/state'
import { ref } from 'vue'
const router=useRouter(),route=useRoute()
const role=computed(()=>state.user?.role||'client')
const navClient=[{to:'/',title:'Inicio',icon:House},{to:'/explorar',title:'Explorar',icon:Search},{to:'/cerca',title:'Cerca de mí',icon:MapPinned},{to:'/guardados',title:'Guardados',icon:Bookmark},{to:'/perfil',title:'Perfil',icon:UserRound}]
const navOwner=[{to:'/tallerista',title:'Resumen',icon:LayoutDashboard},{to:'/tallerista/talleres',title:'Mis talleres',icon:CalendarDays},{to:'/tallerista/publicar',title:'Crear taller',icon:NotebookPen},{to:'/tallerista/inscritos',title:'Inscritos',icon:UsersRound}]
const active=(target)=>route.path===target||target==='/tallerista/talleres' && route.path.includes('/tallerista/editar')
const checking=ref(false)
async function resend(){try{await resendVerification();notify(`Te enviamos un nuevo enlace a ${state.user.email}.`)}catch(e){notify(e.message)}}
async function checkVerified(){try{checking.value=true;notify(await refreshVerification()?'¡Correo verificado!':'Aún no vemos la verificación. Abre el enlace del correo y vuelve a intentar.')}catch(e){notify(e.message)}finally{checking.value=false}}
const reload=()=>window.location.reload()
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
          <RouterLink v-if="state.user.isAdmin" class="top-pill" to="/admin" title="Administración" aria-label="Administración"><ShieldCheck :size="18"/><span>Admin</span></RouterLink><RouterLink class="top-pill" to="/cuenta" title="Mi cuenta" aria-label="Mi cuenta"><UserRound :size="18"/><span>Mi cuenta</span></RouterLink><RouterLink class="top-pill" to="/guia" title="Guía de flujo" aria-label="Guía de flujo"><BookOpenText :size="18"/><span>Guía de flujo</span></RouterLink><RouterLink class="top-pill" to="/opinion" title="Danos tu opinión" aria-label="Danos tu opinión"><MessageSquareText :size="18"/><span>Opinión</span></RouterLink>
          <button class="round-icon" title="Cerrar sesión" aria-label="Cerrar sesión" @click="signOut"><LogOut :size="18"/></button>
        </div>
      </div>
    </header>
    <div v-if="state.user && state.user.emailVerified===false" class="verify-banner" role="status"><div class="shell"><MailWarning :size="18"/> <span>Verifica tu correo: te enviamos un enlace a <b>{{state.user.email}}</b>. Lo necesitas para reservar, reseñar o pedir la aprobación de tallerista.</span><button class="btn light sm" @click="resend">Reenviar</button><button class="btn primary sm" :disabled="checking" @click="checkVerified">Ya lo verifiqué</button></div></div>
    <main class="shell main-area">
      <div v-if="!state.ready" class="loading-area"><div class="spinner"/> {{state.waking?'Despertando el servidor de Hobbiz (puede tardar hasta un minuto)...':'Preparando Hobbiz...'}}</div>
      <div v-else-if="state.initError" class="empty"><h3>No pudimos conectar con Hobbiz</h3><p>{{state.initError}}</p><p class="small muted">Si acabas de abrir la página, el servidor puede estar despertando: espera unos segundos.</p><button class="btn primary" @click="reload">Reintentar</button></div>
      <RouterView v-else v-slot="{ Component }"><component :is="Component" :key="route.fullPath" /></RouterView>
    </main>
    <nav v-if="state.user" class="bottom-nav" aria-label="Navegación principal"><div class="bottom-inner shell"><RouterLink v-for="item in role==='client'?navClient:navOwner" :key="item.to" :to="item.to" :class="{active:active(item.to)}"><component :is="item.icon" :size="22" :stroke-width="active(item.to)?2.4:1.9"/><span>{{item.title}}</span></RouterLink></div></nav>
    <transition name="fade"><div v-if="state.toast" class="toast" role="status">{{state.toast}}</div></transition>
  </div>
</template>

<style>.verify-banner{background:#fff4e5;border-bottom:1px solid #f0d2a8;color:#7a4b16;font-size:.9rem}.verify-banner .shell{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:10px 0}.verify-banner span{flex:1;min-width:220px}</style>

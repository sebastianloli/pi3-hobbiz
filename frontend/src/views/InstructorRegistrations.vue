<script setup>
import { onMounted, ref, computed } from 'vue'
import { UsersRound, CalendarDays, Search } from 'lucide-vue-next'
import OwnerTabs from '../components/OwnerTabs.vue'
import { ensureInstructor } from '../lib/instructor'
import { authRequest, notify, dateText, niceTime } from '../lib/state'
const items=ref([]),workshops=ref([]),selected=ref('all'),query=ref('')
async function load(){try{await ensureInstructor();const [b,w]=await Promise.all([authRequest('/instructor/bookings'),authRequest('/instructor/workshops')]);items.value=b.items;workshops.value=w.items}catch(e){notify(e.message)}}
onMounted(load)
const filtered=computed(()=>items.value.filter(b=>(selected.value==='all'||b.workshopId===selected.value)&&(!query.value||b.studentName.toLowerCase().includes(query.value.toLowerCase())||b.workshop?.title?.toLowerCase().includes(query.value.toLowerCase()))))
</script>
<template><div class="page owner-page"><div class="page-heading"><div><div class="eyebrow earth">GESTIÓN DE PARTICIPANTES</div><h1>Personas registradas</h1><p class="muted">Verifica inscripciones y cupos confirmados por taller.</p></div><span class="progress-pill"><UsersRound :size="17"/> {{items.length}} registros</span></div><OwnerTabs/>
<section class="form-card"><div class="table-toolbar"><label>Filtrar por taller<select v-model="selected"><option value="all">Todos los talleres</option><option v-for="w in workshops" :key="w.id" :value="w.id">{{w.title}}</option></select></label><label>Buscar inscrito<div class="searchbox tight"><Search :size="18"/><input v-model="query" type="search" placeholder="Nombre o taller"/></div></label></div><div class="table-scroller"><table class="data-table"><thead><tr><th>Participante</th><th>Taller</th><th>Fecha / hora</th><th>Cupos</th><th>Estado</th></tr></thead><tbody><tr v-for="b in filtered" :key="b.id"><td><strong>{{b.studentName}}</strong><small>Código {{b.id.slice(0,8).toUpperCase()}}</small></td><td>{{b.workshop?.title}}</td><td>{{dateText(b.workshop?.date)}}<small>{{niceTime(b.workshop?.startsAt)}}</small></td><td>{{b.seats}}</td><td><span class="status-chip">{{b.status}}</span></td></tr></tbody></table></div><div v-if="!filtered.length" class="empty compact">No hay registros que coincidan con tu búsqueda.</div><p class="small muted">Los participantes precargados son datos ficticios. Las reservas nuevas aparecen automáticamente en este listado.</p></section>
</div></template>

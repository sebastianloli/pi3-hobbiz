<script setup>
import { onMounted, ref, computed } from 'vue'
import { CalendarDays, Clock3, Users, Edit3 } from 'lucide-vue-next'
import OwnerTabs from '../components/OwnerTabs.vue'
import { ensureInstructor } from '../lib/instructor'
import { authRequest, notify, dateText, niceTime } from '../lib/state'
const workshops=ref([]),active=ref('all')
async function load(){try{await ensureInstructor();workshops.value=(await authRequest('/instructor/schedule')).items}catch(e){notify(e.message)}}
onMounted(load)
const byDistrict=computed(()=>active.value==='all'?workshops.value:workshops.value.filter(w=>w.district===active.value))
const filtered=computed(()=>byDistrict.value.filter(w=>!w.past))
const done=computed(()=>byDistrict.value.filter(w=>w.past).reverse())
</script>
<template><div class="page owner-page"><div class="page-heading"><div><div class="eyebrow earth">CALENDARIO DE SESIONES</div><h1>Horarios y agenda</h1><p class="muted">Consulta cada fecha, la duración del taller y los cupos ocupados.</p></div></div><OwnerTabs/>
<section class="form-card"><div class="between"><h2>Próximos talleres</h2><label class="inline-label">Distrito<select v-model="active"><option value="all">Todos</option><option v-for="d in [...new Set(workshops.map(w=>w.district))]" :key="d">{{d}}</option></select></label></div><div class="schedule-list"><article v-for="w in filtered" :key="w.id" class="schedule-item"><div class="schedule-date"><CalendarDays :size="20"/><strong>{{dateText(w.date)}}</strong></div><div class="schedule-main"><h3>{{w.title}}</h3><p>{{w.venue}} · {{w.district}}</p><span><Clock3 :size="15"/> {{niceTime(w.startsAt)}} – {{niceTime(w.endsAt)}}</span><span><Users :size="15"/> {{w.reserved}}/{{w.capacity}} inscritos</span></div><RouterLink :to="`/tallerista/editar/${w.id}`" class="btn light sm"><Edit3 :size="15"/> Editar horario</RouterLink></article><div v-if="!filtered.length" class="empty compact">No hay talleres próximos para este filtro.</div></div></section>
<section v-if="done.length" class="form-card"><h2>Talleres realizados</h2><div class="schedule-list"><article v-for="w in done" :key="w.id" class="schedule-item muted"><div class="schedule-date"><CalendarDays :size="20"/><strong>{{dateText(w.date)}}</strong></div><div class="schedule-main"><h3>{{w.title}}</h3><p>{{w.venue}} · {{w.district}}</p><span><Users :size="15"/> {{w.reserved}}/{{w.capacity}} asistentes inscritos</span></div><RouterLink :to="`/taller/${w.id}`" class="btn ghost sm">Ver ficha</RouterLink></article></div></section>
</div></template>

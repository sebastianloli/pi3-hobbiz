<script setup>
import {ref,onMounted,computed} from 'vue'
import {authRequest,notify,dateText,niceTime,state} from '../lib/state'
const bookings=ref([]),month=ref(new Date().toISOString().slice(0,7)),loading=ref(true)
onMounted(async()=>{if(!state.user){loading.value=false;return}try{bookings.value=(await authRequest('/me/bookings')).items.filter(b=>b.status==='confirmada')}catch(e){notify(e.message)}finally{loading.value=false}})
const filtered=computed(()=>bookings.value.filter(b=>b.workshop?.date?.startsWith(month.value)).sort((a,b)=>a.workshop.date.localeCompare(b.workshop.date)))
const days=computed(()=>{
  const [year,mon]=month.value.split('-').map(Number)
  if(!year||!mon)return []
  const count=new Date(year,mon,0).getDate()
  const pad=(new Date(year,mon-1,1).getDay()+6)%7
  return [...Array.from({length:pad},()=>null),...Array.from({length:count},(_,i)=>i+1)]
})
const scheduledOn=day=>filtered.value.filter(b=>Number(b.workshop.date.slice(-2))===day)
const reminders=computed(()=>{const now=Date.now();return bookings.value.filter(b=>{const t=new Date(`${b.workshop?.date}T${b.workshop?.startsAt}:00-05:00`).getTime();return Number.isFinite(t)&&t>=now&&t<now+48*3600000})})
</script>
<template><div class="page"><div class="page-heading"><div><div class="eyebrow earth">CALENDARIO PERSONAL</div><h1>Mi agenda</h1><p class="muted">Consulta cuándo se realizan los talleres que reservaste.</p></div></div><section class="form-card" style="max-width:800px"><label>Mes <input v-model="month" type="month"/></label><p class="small muted">{{filtered.length}} reserva(s) en el mes seleccionado</p><div class="calendar-grid" aria-label="Calendario de reservas"><b v-for="dia in ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']" :key="dia">{{dia}}</b><div v-for="(dia,i) in days" :key="i" :class="['calendar-day',{occupied:dia && scheduledOn(dia).length}]"><strong v-if="dia">{{dia}}</strong><span v-if="dia && scheduledOn(dia).length">{{scheduledOn(dia).length}} taller(es)</span></div></div><div v-if="loading" class="loading-area">Cargando...</div><div v-else-if="!state.user" class="empty"><RouterLink to="/cuenta" class="btn primary">Ingresa a tu cuenta</RouterLink></div><div v-else-if="!filtered.length" class="empty compact">No hay talleres reservados en este mes.</div><div v-for="b in filtered" :key="b.id" class="schedule-item"><strong>{{dateText(b.workshop.date)}}</strong><div><b>{{b.workshop.title}}</b><p>{{niceTime(b.workshop.startsAt)}} · {{b.workshop.district}} · {{b.seats}} cupo(s)</p></div><RouterLink :to="`/taller/${b.workshop.id}`" class="btn outline sm">Ver taller</RouterLink></div><p v-if="reminders.length" class="card-note">Tienes {{reminders.length}} actividad(es) dentro de las próximas 48 horas. Este es un aviso dentro de la web, no una notificación push.</p></section></div></template>

<style scoped>.calendar-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;margin:18px 0}.calendar-grid>b{text-align:center;font-size:.78rem;color:#7c624f}.calendar-day{min-height:62px;background:#fffaf2;border:1px solid #e9dcd0;border-radius:8px;padding:7px;font-size:.8rem}.calendar-day.occupied{background:#f9dfc4;border-color:#d59a6a}.calendar-day span{display:block;font-size:.68rem;color:#9e4b2a;margin-top:6px}@media(max-width:550px){.calendar-day{min-height:48px;padding:4px}.calendar-day span{font-size:.58rem}}</style>

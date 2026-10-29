<script setup>
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import { MapPin, Clock3, Star, Bookmark, Users } from 'lucide-vue-next'
import { money, niceTime, dateText, notify, state, toggleFavorite as toggleSaved } from '../lib/state.js'
const props=defineProps({ workshop:{type:Object,required:true}, favorite:{type:Boolean,default:false}, showCapacity:{type:Boolean,default:false}, showDistance:{type:Boolean,default:false} })
const emit=defineEmits(['favorite-changed'])
const busy=ref(false)
async function toggleFavorite() {
  if(busy.value) return
  try {
    busy.value=true
    const saved=await toggleSaved(props.workshop.id)
    emit('favorite-changed',props.workshop.id)
    notify(saved?'Taller añadido a Guardados':'Se quitó de Guardados')
  } catch(e) { notify(e.message) }
  finally {busy.value=false}
}
const badge=computed(()=>props.workshop.available===0?'No hay más cupos':props.workshop.enrollmentOpen===false?'Inscripciones cerradas':props.workshop.reviewCount>=2?'Popular':'Nuevo')
</script>

<template>
  <article class="workshop-card">
    <RouterLink :to="`/taller/${workshop.id}`" class="photo-link"><img class="workshop-photo" :src="workshop.image" :alt="`Actividad: ${workshop.title}`" loading="lazy"/></RouterLink>
    <button v-if="state.user?.role==='client'" class="bookmark-btn" :class="{'is-saved':favorite}" :disabled="busy" :title="favorite?'Quitar de guardados':'Guardar taller'" :aria-label="favorite?'Quitar de guardados':'Guardar taller'" @click="toggleFavorite"><Bookmark :size="21" :fill="favorite?'currentColor':'none'" /></button>
    <div class="workshop-body">
      <div class="workshop-title-price"><RouterLink :to="`/taller/${workshop.id}`"><h3>{{workshop.title}}</h3></RouterLink><b>{{money(workshop.price)}}</b></div>
      <div class="card-meta"><MapPin :size="15"/> {{workshop.venue}} · {{workshop.district}}<template v-if="showDistance && workshop.distanceKm!=null"> · {{workshop.distanceKm}} km</template></div>
      <div class="card-meta"><Clock3 :size="15"/> {{dateText(workshop.date)}} · {{niceTime(workshop.startsAt)}}–{{niceTime(workshop.endsAt)}}</div>
      <div class="card-chips"><span class="chip-cat">{{workshop.category}}</span><span v-if="workshop.sampleData" class="chip-sample" title="Precio y fecha de ejemplo: confirmar con el taller">Datos de ejemplo</span></div>
      <div class="card-bottom">
        <div class="stars"><Star :size="16" fill="currentColor"/> <strong>{{workshop.rating??'—'}}</strong><small>({{workshop.reviewCount}})</small></div>
        <span class="tag" :class="{'tag-muted':workshop.available===0||workshop.enrollmentOpen===false}">{{workshop.available===0?'No hay más cupos':showCapacity && workshop.enrollmentOpen!==false?`${workshop.available} cupos`:badge}}</span>
      </div>
    </div>
  </article>
</template>

<style scoped>.card-chips{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 2px}.chip-cat,.chip-sample{font-size:12px;padding:2px 8px;border-radius:999px;background:#f6e7da;color:#8a4a2e}.chip-sample{background:#eef0f3;color:#5a6270}</style>

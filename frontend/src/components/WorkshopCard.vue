<script setup>
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import { MapPin, Clock3, Star, Bookmark, Users } from 'lucide-vue-next'
import { authRequest, money, niceTime, dateText, notify, state } from '../lib/state.js'
const props=defineProps({ workshop:{type:Object,required:true}, favorite:{type:Boolean,default:false}, showCapacity:{type:Boolean,default:false} })
const emit=defineEmits(['favorite-changed'])
const busy=ref(false)
async function toggleFavorite() {
  if(busy.value) return
  try {
    busy.value=true
    await authRequest(`/me/favorites/${props.workshop.id}`, {method:props.favorite?'DELETE':'POST'})
    emit('favorite-changed',props.workshop.id)
    notify(props.favorite?'Se quitó de Guardados':'Taller añadido a Guardados')
  } catch(e) { notify(e.message) }
  finally {busy.value=false}
}
const badge=computed(()=>props.workshop.available===0?'Sin cupos':props.workshop.reviewCount>=2?'Popular':'Nuevo')
</script>

<template>
  <article class="workshop-card">
    <RouterLink :to="`/taller/${workshop.id}`" class="photo-link"><img class="workshop-photo" :src="workshop.image" :alt="`Actividad: ${workshop.title}`" loading="lazy"/></RouterLink>
    <button class="bookmark-btn" :class="{'is-saved':favorite}" :disabled="busy" :title="favorite?'Quitar de guardados':'Guardar taller'" :aria-label="favorite?'Quitar de guardados':'Guardar taller'" @click="toggleFavorite"><Bookmark :size="21" :fill="favorite?'currentColor':'none'" /></button>
    <div class="workshop-body">
      <div class="workshop-title-price"><RouterLink :to="`/taller/${workshop.id}`"><h3>{{workshop.title}}</h3></RouterLink><b>{{money(workshop.price)}}</b></div>
      <div class="card-meta"><MapPin :size="15"/> {{workshop.district}}, Lima</div>
      <div class="card-meta"><Clock3 :size="15"/> {{dateText(workshop.date)}} · {{niceTime(workshop.startsAt)}}</div>
      <div class="card-bottom">
        <div class="stars"><Star :size="16" fill="currentColor"/> <strong>{{workshop.rating??'—'}}</strong><small>({{workshop.reviewCount}})</small></div>
        <span class="tag" :class="{'tag-muted':workshop.available===0}">{{showCapacity?`${workshop.available} cupos`:badge}}</span>
      </div>
    </div>
  </article>
</template>

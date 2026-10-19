<script setup>
import { onMounted, ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, MapPin, Clock3, Users, Star, Bookmark, Check, CalendarDays, Package, CircleHelp, UserRound, Share2 } from 'lucide-vue-next'
import { request } from '../lib/api'
import { authRequest, state, money, dateText, niceTime, notify } from '../lib/state'
const route=useRoute(),router=useRouter(),item=ref(null),reviews=ref([]),seats=ref(1),saving=ref(false),booking=ref(false),saved=ref(false),confirmed=ref(null),stars=ref(5),comment=ref(''),reviewBusy=ref(false)
async function load(){try{const [w,r,f]=await Promise.all([request(`/workshops/${route.params.id}`),request(`/workshops/${route.params.id}/reviews`),authRequest('/me/favorites')]);item.value=w.item;reviews.value=r.items;saved.value=f.items.some(x=>x.id===w.item.id)}catch(e){notify(e.message)}}
onMounted(load)
async function toggleSave(){try{saving.value=true;await authRequest(`/me/favorites/${item.value.id}`,{method:saved.value?'DELETE':'POST'});saved.value=!saved.value;notify(saved.value?'Guardado correctamente':'Quitado de Guardados')}catch(e){notify(e.message)}finally{saving.value=false}}
async function reserve(){try{booking.value=true;const r=await authRequest(`/workshops/${item.value.id}/bookings`,{method:'POST',body:{seats:Number(seats.value)}});confirmed.value=r.item;item.value=r.workshop;notify('¡Reserva confirmada!')}catch(e){notify(e.message)}finally{booking.value=false}}
async function sendReview(){try{reviewBusy.value=true;await authRequest(`/workshops/${item.value.id}/reviews`,{method:'POST',body:{stars:Number(stars.value),comment:comment.value}});reviews.value=(await request(`/workshops/${item.value.id}/reviews`)).items;item.value=(await request(`/workshops/${item.value.id}`)).item;comment.value='';notify('¡Gracias por tu valoración!')}catch(e){notify(e.message)}finally{reviewBusy.value=false}}
function share(){navigator.clipboard?.writeText(window.location.href).then(()=>notify('Enlace copiado')).catch(()=>notify('Copia la dirección del navegador para compartir.'))}
</script>
<template>
  <div class="page detail-page"><button class="back-link" @click="router.back()"><ArrowLeft :size="18"/> Volver</button>
    <div v-if="!item" class="loading-area">Cargando detalle del taller...</div>
    <template v-else>
      <div class="detail-layout"><div class="detail-main"><img class="detail-hero-img" :src="item.image" :alt="item.title"/><div class="detail-title-row"><div><span class="eyebrow earth">{{item.category}} · {{item.level}}</span><h1>{{item.title}}</h1><div class="inline-meta"><span><MapPin :size="17"/> {{item.district}}, Lima</span><span><Star :size="17" fill="currentColor"/> {{item.rating??'Nuevo'}} ({{item.reviewCount}} reseñas)</span></div></div><div class="detail-actions"><button class="icon-pill" :disabled="saving" @click="toggleSave"><Bookmark :size="20" :fill="saved?'currentColor':'none'"/>{{saved?'Guardado':'Guardar'}}</button><button class="icon-pill" @click="share"><Share2 :size="18"/> Compartir</button></div></div>
        <section class="text-section"><h2>¿De qué trata este taller?</h2><p>{{item.summary}}</p><p>{{item.description}}</p></section>
        <div class="detail-feature-grid"><div class="feature-box"><CalendarDays :size="25"/><b>Horario</b><span>{{dateText(item.date)}}<br/>{{niceTime(item.startsAt)}} – {{niceTime(item.endsAt)}}</span></div><div class="feature-box"><MapPin :size="25"/><b>Local y ubicación</b><span>{{item.venue}}<br/>{{item.address}}</span></div><div class="feature-box"><Package :size="25"/><b>Materiales incluidos</b><span>{{item.materialsIncluded}}</span></div><div class="feature-box"><CircleHelp :size="25"/><b>¿Qué debes llevar?</b><span>{{item.materialsBring}}</span></div></div>
        <section class="text-section"><h2>Conoce al tallerista</h2><div class="instructor-summary"><span class="avatar">{{item.instructorName[0]}}</span><div><b>{{item.instructorName}}</b><p class="muted">Organiza esta experiencia para grupos pequeños en Lima.</p></div></div></section>
        <section class="text-section"><h2>Reseñas de participantes</h2><p class="muted">{{item.reviewCount}} opiniones · Valoración promedio {{item.rating??'pendiente'}}</p><div v-if="!reviews.length" class="card-note">Este taller todavía no tiene reseñas.</div><article v-for="r in reviews" :key="r.id" class="review-card"><div><b>{{r.name}}</b><span class="rating-review">{{'★'.repeat(r.stars)}}{{'☆'.repeat(5-r.stars)}}</span></div><p>{{r.comment}}</p></article>
          <form class="review-form" @submit.prevent="sendReview"><h3>Dejar una reseña</h3><p class="muted small">Se requiere tener una reserva registrada en este taller.</p><div class="rating-input"><button v-for="s in 5" :key="s" type="button" :aria-label="`${s} estrellas`" @click="stars=s" :class="{'picked':s<=stars}">★</button></div><textarea v-model="comment" rows="3" minlength="8" maxlength="500" placeholder="Cuéntanos cómo fue tu experiencia..." required/><button class="btn light" type="submit" :disabled="reviewBusy">Enviar valoración</button></form>
        </section>
      </div>
      <aside class="booking-box"><div class="booking-price">{{money(item.price)}} <small>por persona</small></div><div class="booking-summary"><p><CalendarDays :size="18"/> {{dateText(item.date)}}</p><p><Clock3 :size="18"/> {{niceTime(item.startsAt)}} – {{niceTime(item.endsAt)}}</p><p><Users :size="18"/> {{item.available}} de {{item.capacity}} cupos disponibles</p><p><MapPin :size="18"/> {{item.district}}</p></div>
        <template v-if="confirmed"><div class="confirmation"><Check :size="30"/><strong>¡Reserva confirmada!</strong><p>Código {{confirmed.id.slice(0,8).toUpperCase()}} · {{confirmed.seats}} cupo(s)</p><p>Se agregó a tu perfil.</p></div><RouterLink to="/perfil" class="btn primary full">Ver mis reservas</RouterLink></template>
        <template v-else><label class="field">Cantidad de cupos<select v-model.number="seats" :disabled="item.available===0"><option v-for="n in Math.min(5,item.available)" :key="n" :value="n">{{n}} {{n===1?'persona':'personas'}}</option></select></label><div class="booking-total"><span>Total estimado</span><b>{{money(item.price*seats)}}</b></div><button class="btn primary full" :disabled="booking || item.available===0" @click="reserve">{{item.available===0?'Sin cupos disponibles':booking?'Confirmando...':'Reservar taller'}}</button><p class="muted small center">Reserva simulada · No se procesan pagos reales.</p></template>
      </aside></div>
    </template>
  </div>
</template>

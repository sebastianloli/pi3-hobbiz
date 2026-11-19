<script setup>
// Estado de verificación del tallerista: en revisión → envía su solicitud (y, si quiere, el local que representa).
import { onMounted, reactive, ref, computed } from 'vue'
import { ShieldAlert, ShieldX, Clock } from 'lucide-vue-next'
import { state, authRequest, notify, reloadMe } from '../lib/state'
const venues = ref([]), busy = ref(false), editing = ref(false)
const req = computed(() => state.user?.verificationRequest)
const form = reactive({ claimVenueId: req.value?.claimVenueId || '', message: req.value?.message || '', contact: req.value?.contact || '' })
onMounted(async () => { try { venues.value = (await authRequest('/instructors')).items.filter(v => !v.claimed) } catch {} })
async function send() {
  try { busy.value = true; state.user = (await authRequest('/instructor/verification', { method: 'POST', body: form })).user; editing.value = false; notify('Solicitud enviada. El equipo de Hobbiz la revisará pronto.') }
  catch (e) { notify(e.message) } finally { busy.value = false }
}
async function refresh() { try { await reloadMe(); if (state.user.instructorStatus === 'approved') notify('¡Tu cuenta fue aprobada! Ya puedes publicar talleres.') } catch (e) { notify(e.message) } }
const when = (d) => d ? new Date(d).toLocaleDateString('es-PE', { day: 'numeric', month: 'long' }) : ''
</script>
<template>
  <section class="form-card verification-card">
    <template v-if="state.user.instructorStatus === 'rejected'">
      <h2><ShieldX :size="20"/> Tu solicitud no fue aprobada</h2>
      <p class="muted">Motivo: {{ state.user.rejectionReason || 'sin detalle' }}. Puedes corregir los datos y enviarla otra vez.</p>
    </template>
    <template v-else-if="req && !editing">
      <h2><Clock :size="20"/> Tu cuenta está en revisión</h2>
      <p class="muted">Recibimos tu solicitud el {{ when(req.submittedAt) }}<template v-if="req.claimVenueName"> para administrar <b>{{ req.claimVenueName }}</b></template>. Mientras tanto puedes personalizar tu perfil; podrás publicar talleres cuando la aprobemos.</p>
      <div class="actions"><button class="btn light sm" @click="refresh">Actualizar estado</button><button class="btn ghost sm" @click="editing = true">Editar solicitud</button></div>
    </template>
    <template v-else>
      <h2><ShieldAlert :size="20"/> Verifica tu cuenta de tallerista</h2>
      <p class="muted">Para proteger a los clientes, el equipo de Hobbiz revisa cada cuenta antes de que publique talleres. Cuéntanos quién eres; si tu taller ya aparece en el directorio, indícalo y te traspasaremos su ficha.</p>
    </template>
    <form v-if="state.user.instructorStatus !== 'approved' && (!req || editing || state.user.instructorStatus === 'rejected')" class="form-grid" @submit.prevent="send">
      <p v-if="state.user.emailVerified === false" class="span-all card-note small warn">Primero verifica tu correo con el enlace que te enviamos (aviso en la parte superior).</p>
      <label class="span-all">¿Tu taller ya aparece en el directorio de Hobbiz?<select v-model="form.claimVenueId"><option value="">No, es un taller nuevo</option><option v-for="v in venues" :key="v.id" :value="v.id">{{ v.name }} · {{ v.district }}</option></select></label>
      <label class="span-all">Cuéntanos sobre tu taller y tu rol en él<textarea v-model.trim="form.message" required minlength="10" maxlength="600" rows="3" placeholder="Ej. Soy la fundadora de Estudio Meza, dictamos cerámica en Barranco desde 2021."/></label>
      <label class="span-all">¿Cómo te contactamos para confirmarlo? (Instagram del taller, teléfono…)<input v-model.trim="form.contact" maxlength="160" placeholder="@mitaller o +51 999 999 999"/></label>
      <button class="btn primary" :disabled="busy || state.user.emailVerified === false">{{ busy ? 'Enviando...' : 'Enviar solicitud' }}</button>
    </form>
  </section>
</template>
<style scoped>.verification-card{border-left:6px solid #d18b32;margin-bottom:18px}.verification-card h2{display:flex;gap:8px;align-items:center}.actions{display:flex;gap:8px}</style>

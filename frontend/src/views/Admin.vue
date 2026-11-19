<script setup>
// Panel del equipo de Hobbiz (correos en ADMIN_EMAILS): aprueba o rechaza talleristas y lee el formulario de opinión.
import { onMounted, ref, reactive } from 'vue'
import { ShieldCheck, MailCheck, MailWarning, Store, Check, X, MessageSquareText } from 'lucide-vue-next'
import { authRequest, notify } from '../lib/state'
const status = ref('pending'), items = ref([]), feedback = ref([]), loading = ref(false), busy = ref(''), reasons = reactive({}), transfer = reactive({})
const labels = { pending: 'En revisión', approved: 'Aprobados', rejected: 'Rechazados', all: 'Todos' }
async function load() { try { loading.value = true; items.value = (await authRequest(`/admin/instructors?status=${status.value}`)).items; for (const i of items.value) transfer[i.id] ??= true } catch (e) { notify(e.message) } finally { loading.value = false } }
async function loadFeedback() { try { feedback.value = (await authRequest('/admin/feedback')).items } catch (e) { notify(e.message) } }
async function approve(u) { try { busy.value = u.id; const r = await authRequest(`/admin/instructors/${u.id}/approve`, { method: 'POST', body: { transferVenue: transfer[u.id] } }); notify(r.venue ? `Aprobado. Se le traspasó el local con ${r.transferredWorkshops} sesión(es).` : 'Tallerista aprobado.'); await load() } catch (e) { notify(e.message) } finally { busy.value = '' } }
async function reject(u) { try { busy.value = u.id; await authRequest(`/admin/instructors/${u.id}/reject`, { method: 'POST', body: { reason: reasons[u.id] || '' } }); notify('Solicitud rechazada.'); await load() } catch (e) { notify(e.message) } finally { busy.value = '' } }
const when = (d) => d ? new Date(d).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' }) : '—'
onMounted(() => { load(); loadFeedback() })
</script>
<template>
  <div class="page admin-page">
    <div class="page-heading"><div><div class="eyebrow earth">EQUIPO HOBBIZ</div><h1>Administración</h1><p class="muted">Revisa y aprueba las cuentas de talleristas antes de que publiquen talleres.</p></div></div>
    <div class="admin-tabs"><button v-for="(l, k) in labels" :key="k" :class="{ selected: status === k }" @click="status = k; load()">{{ l }}</button></div>
    <div class="list-intro">{{ loading ? 'Cargando...' : `${items.length} tallerista(s)` }}</div>
    <article v-for="u in items" :key="u.id" class="form-card admin-card">
      <div class="between"><div><h3><ShieldCheck :size="18"/> {{ u.name }} <small class="muted">{{ u.studioName && u.studioName !== u.name ? `· ${u.studioName}` : '' }}</small></h3>
        <p class="muted small">{{ u.email }} · registrado {{ when(u.createdAt) }}</p></div>
        <span class="status-chip">{{ labels[u.instructorStatus] || u.instructorStatus }}</span></div>
      <p class="small"><MailCheck v-if="u.emailVerified" :size="15" class="ok"/><MailWarning v-else :size="15" class="warn"/> {{ u.emailVerified ? 'Correo verificado' : 'Correo SIN verificar' }}</p>
      <div v-if="u.verificationRequest" class="card-note small">
        <b>Solicitud del {{ when(u.verificationRequest.submittedAt) }}:</b> {{ u.verificationRequest.message }}
        <template v-if="u.verificationRequest.contact"><br/><b>Contacto:</b> {{ u.verificationRequest.contact }}</template>
        <template v-if="u.verificationRequest.claimVenueId"><br/><Store :size="14"/> <b>Dice representar a:</b> <RouterLink :to="`/estudio/${u.verificationRequest.claimVenueId}`" class="text-link">{{ u.verificationRequest.claimVenueName }}</RouterLink></template>
      </div>
      <p v-else class="muted small">Aún no envía su solicitud de verificación.</p>
      <p v-if="u.rejectionReason" class="small"><b>Motivo del rechazo:</b> {{ u.rejectionReason }}</p>
      <div v-if="u.instructorStatus !== 'approved'" class="admin-actions">
        <label v-if="u.verificationRequest?.claimVenueId" class="check-line"><input v-model="transfer[u.id]" type="checkbox"/> Traspasarle la ficha y las sesiones de {{ u.verificationRequest.claimVenueName }}</label>
        <button class="btn primary sm" :disabled="busy === u.id" @click="approve(u)"><Check :size="15"/> Aprobar</button>
        <input v-model="reasons[u.id]" maxlength="400" placeholder="Motivo del rechazo (se le mostrará)" aria-label="Motivo del rechazo"/>
        <button class="btn outline sm" :disabled="busy === u.id" @click="reject(u)"><X :size="15"/> Rechazar</button>
      </div>
      <p class="muted small">Verifica por Instagram, teléfono o en persona que la cuenta pertenece al taller antes de aprobar.</p>
    </article>
    <div v-if="!loading && !items.length" class="empty compact">No hay talleristas en este estado.</div>
    <section class="text-section"><h2><MessageSquareText :size="20"/> Formulario de opinión ({{ feedback.length }})</h2>
      <article v-for="f in feedback" :key="f.id" class="review-card"><div><b>{{ f.area }} · {{ f.rating }}/5</b><small class="muted">{{ when(f.createdAt) }} · {{ f.role === 'instructor' ? 'tallerista' : 'cliente' }}</small></div>
        <p>{{ f.comment }}</p><p v-if="f.recommendation" class="muted small">Recomendación: {{ f.recommendation }}</p>
        <p class="muted small">Facilidad: {{ f.understanding ?? '—' }}/5 · Nuevas funciones: {{ f.newFeatures ?? '—' }}/5</p></article>
      <div v-if="!feedback.length" class="empty compact">Aún no hay respuestas.</div></section>
  </div>
</template>
<style scoped>
.admin-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}.admin-tabs button{border:1px solid #e2cdb7;background:#fff;border-radius:999px;padding:7px 14px;cursor:pointer}.admin-tabs button.selected{background:#c65c38;color:#fff;border-color:#c65c38}
.admin-card{margin-bottom:14px;display:grid;gap:8px}.admin-card h3{display:flex;gap:6px;align-items:center;margin:0}.admin-card p{margin:0}
.admin-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.admin-actions input[type=text],.admin-actions input:not([type]){flex:1;min-width:200px;padding:8px 10px;border:1px solid #dfcbb5;border-radius:10px}
.check-line{display:flex;gap:6px;align-items:center;width:100%}.ok{color:#3f7d4e}.warn{color:#b0462b}.between{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}
</style>

<script setup>
// Mapa de Hobbiz. Usa Google Maps (Maps JavaScript API) si hay VITE_GOOGLE_MAPS_API_KEY;
// si no hay clave, o Google rechaza la clave o no carga, usa Leaflet + OpenStreetMap.
import { ref, onBeforeUnmount } from 'vue'
import GoogleMap from './GoogleMap.vue'
import LeafletMap from './LeafletMap.vue'
import { googleUnavailable, onGoogleAuthFailure } from '../lib/googleMaps'

defineOptions({ inheritAttrs: false })
const useGoogle = ref(!googleUnavailable())
const stop = onGoogleAuthFailure(() => { useGoogle.value = false })
onBeforeUnmount(stop)
</script>

<template>
  <GoogleMap v-if="useGoogle" v-bind="$attrs" @failed="useGoogle = false"/>
  <LeafletMap v-else v-bind="$attrs"/>
</template>

<script setup>
defineProps({title:String,subtitle:String,to:String,linkText:{type:String,default:'Ver todos'}})
</script>
<template><div class="section-heading"><div><h2>{{title}}</h2><p v-if="subtitle" class="muted">{{subtitle}}</p></div><RouterLink v-if="to" :to="to" class="text-link">{{linkText}} →</RouterLink></div></template>

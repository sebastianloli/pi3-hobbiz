import { createApp } from 'vue'
import App from './App.vue'
import router from './router.js'
import { initialize, setSessionLostHandler } from './lib/state'
import './style.css'

// Si la sesión se pierde durante el uso, se regresa al ingreso conservando la página actual.
setSessionLostHandler(()=>{const here=router.currentRoute.value.fullPath;if(!here.startsWith('/cuenta'))router.push({path:'/cuenta',query:{redirect:here}})})
// Se restaura la sesión recordada antes de resolver la primera ruta protegida.
initialize().then(()=>createApp(App).use(router).mount('#app'))

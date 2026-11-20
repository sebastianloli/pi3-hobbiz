import { createApp } from 'vue'
import App from './App.vue'
import router from './router.js'
import { initialize, setSessionLostHandler } from './lib/state'
import './style.css'

// Si la sesión se pierde durante el uso, se regresa al ingreso conservando la página actual.
setSessionLostHandler(()=>{const here=router.currentRoute.value.fullPath;if(!here.startsWith('/cuenta'))router.push({path:'/cuenta',query:{redirect:here}})})
// La app se muestra de inmediato ("Conectando con Hobbiz…"); el router espera a initialize() antes de
// decidir a qué pantalla ir, así se restaura la sesión recordada sin dejar la página en blanco.
createApp(App).use(router).mount('#app')
initialize()

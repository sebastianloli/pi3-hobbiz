import { createRouter, createWebHistory } from 'vue-router'
import Home from './views/Home.vue'
import Account from './views/Account.vue'
import InstructorStudio from './views/InstructorStudio.vue'
import Feedback from './views/Feedback.vue'
import Calendar from './views/Calendar.vue'
import Explore from './views/Explore.vue'
import Saved from './views/Saved.vue'
import Profile from './views/Profile.vue'
import WorkshopDetail from './views/WorkshopDetail.vue'
import InstructorDashboard from './views/InstructorDashboard.vue'
import InstructorWorkshops from './views/InstructorWorkshops.vue'
import InstructorEditor from './views/InstructorEditor.vue'
import InstructorSchedule from './views/InstructorSchedule.vue'
import InstructorRegistrations from './views/InstructorRegistrations.vue'
import InstructorReviews from './views/InstructorReviews.vue'
import FlowGuide from './views/FlowGuide.vue'
import NearMe from './views/NearMe.vue'
import StudioPublic from './views/StudioPublic.vue'
import { state, homeFor } from './lib/state'

const routes = [
  { path:'/cuenta', component:Account, meta:{ public:true } },
  { path:'/opinion',component:Feedback },
  { path:'/agenda',component:Calendar, meta:{ role:'client' } },
  { path:'/cerca', component:NearMe, meta:{ role:'client' } },
  { path:'/estudio/:id', component:StudioPublic },
  { path:'/tallerista/perfil',component:InstructorStudio,meta:{role:'instructor'} },
  { path:'/', component:Home, meta:{ role:'client' } },
  { path:'/explorar', component:Explore, meta:{ role:'client' } },
  { path:'/guardados', component:Saved, meta:{ role:'client' } },
  { path:'/perfil', component:Profile, meta:{ role:'client' } },
  { path:'/taller/:id', component:WorkshopDetail },
  { path:'/tallerista', component:InstructorDashboard, meta:{ role:'instructor' } },
  { path:'/tallerista/talleres', component:InstructorWorkshops, meta:{ role:'instructor' } },
  { path:'/tallerista/publicar', component:InstructorEditor, meta:{ role:'instructor' } },
  { path:'/tallerista/editar/:id', component:InstructorEditor, meta:{ role:'instructor' } },
  { path:'/tallerista/agenda', component:InstructorSchedule, meta:{ role:'instructor' } },
  { path:'/tallerista/inscritos', component:InstructorRegistrations, meta:{ role:'instructor' } },
  { path:'/tallerista/resenas', component:InstructorReviews, meta:{ role:'instructor' } },
  { path:'/guia', component:FlowGuide },
  { path:'/:pathMatch(.*)*', redirect:'/' },
]
const router=createRouter({ history:createWebHistory(), routes, scrollBehavior:()=>({top:0}) })
// Inicio de sesión obligatorio: cualquier ruta (salvo /cuenta) exige usuario autenticado,
// y las secciones de cliente/tallerista solo se abren con la cuenta del rol correspondiente.
router.beforeEach((to)=>{
  if(to.meta.public) return true
  if(!state.user) return { path:'/cuenta', query: to.fullPath!=='/' ? { redirect: to.fullPath } : {} }
  if(to.meta.role && to.meta.role!==state.user.role) return homeFor(state.user)
  return true
})
export default router

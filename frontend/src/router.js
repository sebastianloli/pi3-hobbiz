import { createRouter, createWebHistory } from 'vue-router'
import Home from './views/Home.vue'
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

const routes = [
  { path:'/', component:Home, meta:{ role:'client' } },
  { path:'/explorar', component:Explore, meta:{ role:'client' } },
  { path:'/guardados', component:Saved, meta:{ role:'client' } },
  { path:'/perfil', component:Profile, meta:{ role:'client' } },
  { path:'/taller/:id', component:WorkshopDetail, meta:{ role:'client' } },
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
export default createRouter({ history:createWebHistory(), routes, scrollBehavior:()=>({top:0}) })

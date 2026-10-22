import { demoLogin, state } from './state'
export async function ensureInstructor(){
  if(state.user?.role==='instructor')return
  if(state.mode==='demo')return demoLogin('instructor')
  throw new Error('Inicia sesión como tallerista desde Mi cuenta.')
}

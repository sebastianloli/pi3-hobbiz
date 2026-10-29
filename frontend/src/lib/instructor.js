import { state } from './state'
// El acceso por rol lo controla el router; esto solo protege llamadas directas.
export async function ensureInstructor(){
  if(state.user?.role==='instructor')return
  throw new Error('Inicia sesión con una cuenta de tallerista desde Mi cuenta.')
}

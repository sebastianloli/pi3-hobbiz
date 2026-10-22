import { demoLogin, state } from './state'
export async function ensureInstructor() {
  if (state.user?.role !== 'instructor') await demoLogin('instructor')
}

import test from 'node:test'
import assert from 'node:assert/strict'
import {createApp} from '../src/app.js'
import {createSeedStore} from '../src/data.js'

async function withApi(options,fn){
  const server=createApp(options.store||createSeedStore(),options.appOptions||{}).listen(0,'127.0.0.1')
  await new Promise(resolve=>server.once('listening',resolve))
  const url=`http://127.0.0.1:${server.address().port}/api`
  async function call(path,{method='GET',token,body}={}){
    const r=await fetch(url+path,{method,headers:{...(token?{Authorization:`Bearer ${token}`}:{ }),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined})
    return {status:r.status,data:r.status===204?null:await r.json()}
  }
  try{await fn(call)}finally{await new Promise(resolve=>server.close(resolve))}
}
const instructor=api=>api('/auth/login',{method:'POST',body:{email:'tallerista@hobbiz.pe',password:'Demo12345!'}})

function validWorkshop(){return {
  title:'Linograbado y estampas',summary:'Aprende a estampar diseños.',description:'Diseña y talla tu propio sello para crear piezas artísticas.',
  category:'Arte',district:'Pueblo Libre',venue:'Estudio Meza',address:'Av. Sucre 500',
  date:'2026-11-21',startsAt:'14:00',endsAt:'17:00',capacity:8,price:60,
  level:'Principiante',materialsIncluded:'Tinta y planchas',materialsBring:'Mandil',image:'/images/arte.jpg'
}}

test('oculta talleres agotados salvo búsqueda por nombre exacto',async()=>withApi({},async api=>{
  const token=(await instructor(api)).data.token
  const w=validWorkshop();w.capacity=1
  const r=await api('/instructor/workshops',{method:'POST',token,body:w})
  assert.equal(r.status,201)
  const client=(await api('/auth/login',{method:'POST',body:{email:'cliente@hobbiz.pe',password:'Demo12345!'}})).data.token
  assert.equal((await api(`/workshops/${r.data.item.id}/bookings`,{method:'POST',token:client,body:{seats:1}})).status,201)
  const catalog=(await api('/workshops')).data.items
  assert.equal(catalog.some(x=>x.id===r.data.item.id),false)
  const exact=(await api('/workshops?q=Linograbado%20y%20estampas')).data.items
  assert.equal(exact.find(x=>x.id===r.data.item.id).available,0)
}))

test('publicación recurrente genera instancias por semana y cupos propios',async()=>withApi({},async api=>{
  const token=(await instructor(api)).data.token
  const response=await api('/instructor/workshops',{method:'POST',token,body:{...validWorkshop(),recurrence:'weekly',repeatCount:3}})
  assert.equal(response.status,201)
  assert.equal(response.data.createdCount,3)
  const list=(await api('/instructor/workshops',{token})).data.items.filter(w=>w.recurrenceGroupId)
  assert.deepEqual(list.map(w=>w.date),['2026-11-21','2026-11-28','2026-12-05'])
  assert.ok(new Set(list.map(w=>w.id)).size===3)
}))

test('perfil público y feedback se validan y registran',async()=>withApi({},async api=>{
  const token=(await instructor(api)).data.token
  const studio=await api('/instructor/studio',{method:'PATCH',token,body:{displayName:'Estudio Meza',bio:'Grabado original',link:'https://ejemplo.pe',accent:'oliva'}})
  assert.equal(studio.status,200)
  const listing=(await api('/workshops/t-1')).data.item
  assert.equal(listing.instructorName,'Estudio Meza')
  const denied=await api('/instructor/studio',{method:'PATCH',token,body:{displayName:'E',bio:'x',link:'javascript:alert(1)',accent:'oliva'}})
  assert.equal(denied.status,400)
  const fb=await api('/feedback',{method:'POST',token,body:{rating:5,area:'general',comment:'La navegación es clara'}})
  assert.equal(fb.status,201)
}))

test('modo Firebase comprueba tokens y mantiene el mismo perfil en endpoints',async()=>{
  const store=createSeedStore();const saved=[]
  await withApi({store,appOptions:{mode:'firebase-mongo',verifyIdToken:async token=>{
    if(token==='firebase-client')return {uid:'cliente-1',email:'cliente@hobbiz.pe'}
    if(token==='firebase-new')return {uid:'uid-nuevo',email:'nuevo@example.com'}
    throw new Error('Token inválido')
  },persistOne:async(kind,record)=>saved.push({kind,id:record.id})}},async api=>{
    assert.equal((await api('/auth/login',{method:'POST',body:{email:'x',password:'y'}})).status,409)
    assert.equal((await api('/me/favorites')).status,401)
    assert.equal((await api('/me/favorites',{token:'invalido'})).status,401)
    assert.equal((await api('/me/favorites',{token:'firebase-client'})).status,200)
    assert.equal((await api('/account',{method:'POST',token:'firebase-new',body:{name:'Lucía Prueba',role:'client'}})).status,200)
    assert.equal((await api('/auth/me',{token:'firebase-new'})).data.user.email,'nuevo@example.com')
    assert.equal((await api('/me',{method:'PATCH',token:'firebase-new',body:{name:'Lucía Actualizada'}})).status,200)
    assert.ok(saved.some(x=>x.kind==='users'&&x.id==='uid-nuevo'))
  })
})

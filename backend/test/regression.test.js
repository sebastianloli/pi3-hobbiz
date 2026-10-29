import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.js'
import { createSeedStore } from '../src/data.js'

// Regresiones encontradas en la validación de exigencias (ultracode).
const future=(days)=>new Date(Date.now()+days*86400000).toISOString().slice(0,10)
async function withApi(fn){
  const server=createApp(createSeedStore()).listen(0,'127.0.0.1')
  await new Promise(r=>server.once('listening',r))
  const url=`http://127.0.0.1:${server.address().port}/api`
  const api=async(path,{method='GET',token,body}={})=>{const r=await fetch(url+path,{method,headers:{...(token?{Authorization:`Bearer ${token}`}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body!==undefined?JSON.stringify(body):undefined});return {status:r.status,data:r.status===204?null:await r.json()}}
  const login=async email=>(await api('/auth/login',{method:'POST',body:{email,password:'Demo12345!'}})).data.token
  try{await fn(api,await login('cliente@hobbiz.pe'),await login('tallerista@hobbiz.pe'))}finally{await new Promise(r=>server.close(r))}
}
const draft=(over={})=>({title:'Mosaico',summary:'Arte con teselas.',description:'Crea una composición decorativa paso a paso.',category:'Arte',price:50,district:'Miraflores',venue:'Taller X',address:'Av. Larco 400',lat:-12.1209,lon:-77.0296,date:future(20),startsAt:'10:00',endsAt:'12:00',capacity:10,level:'Principiante',materialsIncluded:'Teselas',materialsBring:'Mandil',image:'/images/arte.jpg',...over})

test('radio de 500 m se respeta en Cerca de mí',()=>withApi(async(api,c)=>{
  const r=await api('/workshops?lat=-12.1211&lon=-77.0297&radiusKm=0.5',{token:c})
  assert.ok(r.data.items.every(w=>w.distanceKm<=0.5),JSON.stringify(r.data.items.map(w=>w.distanceKm)))
}))

test('búsqueda por nombre del local y sin tildes; agotado visible por nombre exacto del local',()=>withApi(async(api,c,t)=>{
  assert.ok((await api('/workshops?q=Casona%20Trazzo',{token:c})).data.count>=1)
  assert.ok((await api('/workshops?q=ceramica',{token:c})).data.count>=1)
  assert.ok((await api('/workshops?day=sabado',{token:c})).data.count>=1)
  const made=await api('/instructor/workshops',{method:'POST',token:t,body:draft({capacity:1,venue:'Local Único Prueba'})})
  await api(`/workshops/${made.data.item.id}/bookings`,{method:'POST',token:c,body:{seats:1}})
  const hit=(await api('/workshops?q=Local%20Unico%20Prueba',{token:c})).data.items
  assert.equal(hit[0]?.available,0)
}))

test('el pin debe estar dentro del polígono real del distrito',()=>withApi(async(api,c,t)=>{
  for (const [district,lat,lon] of [['Miraflores',-12.1135,-77.0128],['Barranco',-12.164,-77.0225],['Barranco',-12.145,-77.010],['Miraflores',-12.139,-77.021],['Miraflores',-12.125,-77.055]])
    assert.equal((await api('/instructor/workshops',{method:'POST',token:t,body:draft({district,lat,lon})})).status,400,`${district} ${lat},${lon}`)
  for (const district of ['constructor','toString','__proto__'])
    assert.equal((await api('/instructor/workshops',{method:'POST',token:t,body:draft({district})})).status,400)
}))

test('fechas pasadas o imposibles se rechazan; talleres pasados no se reservan ni listan',()=>withApi(async(api,c,t)=>{
  assert.equal((await api('/instructor/workshops',{method:'POST',token:t,body:draft({date:'2020-01-01'})})).status,400)
  assert.equal((await api('/instructor/workshops',{method:'POST',token:t,body:draft({date:'2027-02-31'})})).status,400)
}))

test('monto recaudado conserva el precio pagado aunque el precio cambie después',()=>withApi(async(api,c,t)=>{
  const before=(await api('/instructor/dashboard',{token:t})).data.byWorkshop.find(r=>r.id==='t-3').estimatedGross
  await api('/workshops/t-3/bookings',{method:'POST',token:c,body:{seats:1}})
  await api('/instructor/workshops/t-3',{method:'PUT',token:t,body:{price:999}})
  const after=(await api('/instructor/dashboard',{token:t})).data.byWorkshop.find(r=>r.id==='t-3').estimatedGross
  assert.equal(after,before+40)
}))

test('guardados: solo clientes, sin talleres ocultos',()=>withApi(async(api,c,t)=>{
  assert.equal((await api('/me/favorites/t-2',{method:'POST',token:t})).status,403)
  assert.equal((await api('/me/favorites/t-2',{method:'POST',token:c})).status,200)
  await api('/instructor/workshops/t-2',{method:'PUT',token:t,body:{published:false}})
  assert.equal((await api('/me/favorites',{token:c})).data.items.some(w=>w.id==='t-2'),false)
  assert.equal((await api('/me/favorites/t-2',{method:'POST',token:c})).status,404)
  assert.equal((await api('/workshops/t-2/reviews',{method:'POST',token:c,body:{stars:5,comment:'Taller oculto no'}})).status,404)
}))

test('validación de tipos: estrellas, preferencias parciales, registro y estudio',()=>withApi(async(api,c,t)=>{
  for (const stars of [true,[4],' 4 ','5']) assert.equal((await api('/workshops/t-1/reviews',{method:'POST',token:c,body:{stars,comment:'Comentario válido'}})).status,400)
  await api('/me',{method:'PATCH',token:c,body:{preferences:{budget:60}}})
  const prefs=(await api('/auth/me',{token:c})).data.user.preferences
  assert.deepEqual([prefs.budget,prefs.district,prefs.interests],[60,'Miraflores',['Arte','Cerámica']])
  assert.equal((await api('/auth/register',{method:'POST',body:{name:'Ana',email:'a@b.pe',password:12345678}})).status,400)
  assert.equal((await api('/instructor/studio',{method:'PATCH',token:t,body:{accentColor:123}})).status,400)
  assert.equal((await api('/instructor/studio',{method:'PATCH',token:t,body:{district:'constructor'}})).status,400)
}))

test('perfil público muestra reseñas y si la ficha está reclamada',()=>withApi(async(api,c)=>{
  const demo=(await api('/instructors/tallerista-1',{token:c})).data.item
  assert.equal(demo.claimed,true); assert.ok(demo.reviews.length>=1)
  assert.equal((await api('/instructors/venue-mundodebarro',{token:c})).data.item.claimed,false)
}))

test('segunda ronda: fecha pasada al editar, presupuesto tipado y nombre de reseña actualizado',()=>withApi(async(api,c,t)=>{
  assert.equal((await api('/instructor/workshops/t-1',{method:'PUT',token:t,body:{date:'2020-01-01'}})).status,400)
  for (const budget of [null,' ',true]) assert.equal((await api('/me',{method:'PATCH',token:c,body:{preferences:{budget}}})).status,400)
  assert.equal((await api('/me',{method:'PATCH',token:c,body:{name:'x'.repeat(101)}})).status,400)
  await api('/me',{method:'PATCH',token:c,body:{name:'Alexandra Quispe'}})
  const names=(await api('/workshops/t-1/reviews',{token:c})).data.items.map(r=>r.name)
  assert.ok(names.includes('Alexandra Q.'),names.join(','))
}))

test('rama Santiago: rango horario exacto y coordenadas latitude/longitude',()=>withApi(async(api,c,t)=>{
  const r=(await api('/workshops?startsAfter=15:00&endsBefore=18:00',{token:c})).data.items
  assert.ok(r.length>0 && r.every(w=>w.startsAt>='15:00'&&w.endsAt<='18:00'))
  assert.equal((await api('/workshops?startsAfter=18:00&endsBefore=10:00',{token:c})).status,400)
  assert.equal((await api('/workshops?startsAfter=25:00',{token:c})).status,400)
  const body=draft({lat:undefined,lon:undefined,latitude:-12.1209,longitude:-77.0296})
  const made=await api('/instructor/workshops',{method:'POST',token:t,body})
  assert.equal(made.status,201)
  assert.deepEqual([made.data.item.lat,made.data.item.lon,made.data.item.latitude],[-12.1209,-77.0296,undefined])
}))

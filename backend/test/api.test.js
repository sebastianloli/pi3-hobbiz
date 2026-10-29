import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.js'
import { createSeedStore } from '../src/data.js'
const future=(days)=>{const d=new Date(Date.now()+days*86400000);return d.toISOString().slice(0,10)}

async function withApi(fn) {
  const server = createApp(createSeedStore()).listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  const url=`http://127.0.0.1:${server.address().port}/api`
  async function api(path, {method='GET', body, token}={}) {
    const response=await fetch(url+path,{method,headers:{...(token?{Authorization:`Bearer ${token}`}:{ }),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined})
    const json=response.status===204?null:await response.json()
    return {status:response.status,data:json}
  }
  try {await fn(api)} finally {await new Promise(resolve=>server.close(resolve))}
}
const client=api=>api('/auth/login',{method:'POST',body:{email:'cliente@hobbiz.pe',password:'Demo12345!'}})
const instructor=api=>api('/auth/login',{method:'POST',body:{email:'tallerista@hobbiz.pe',password:'Demo12345!'}})

test('catálogo solo de Miraflores y Barranco, búsqueda, filtros y cercanía',async()=>withApi(async api=>{
  const token=(await client(api)).data.token
  const all=await api('/workshops',{token})
  assert.equal(all.status,200)
  assert.ok(all.data.count>=20)
  assert.ok(all.data.items.every(w=>['Miraflores','Barranco'].includes(w.district)))
  assert.ok(all.data.items.every(w=>Number.isFinite(w.lat)&&Number.isFinite(w.lon)))
  for (const w of all.data.items) for (const k of ['title','category','district','address','price','date','startsAt','endsAt']) assert.ok(w[k]!==undefined&&w[k]!=='',`${w.id} sin ${k}`)
  const meta=(await api('/meta')).data
  assert.deepEqual(meta.districts,['Miraflores','Barranco'])
  const filtered=await api('/workshops?category=Cer%C3%A1mica&district=Miraflores&maxPrice=50',{token})
  assert.deepEqual(filtered.data.items.map(w=>w.id),['t-1'])
  const night=await api('/workshops?timeOfDay=noche',{token})
  assert.ok(night.data.count>0 && night.data.items.every(w=>w.startsAt>='18:00'))
  const morning=await api('/workshops?timeOfDay=ma%C3%B1ana',{token})
  assert.ok(morning.data.count>0 && morning.data.items.every(w=>w.startsAt<'12:00'))
  // Cercanía con coordenadas exactas del taller: desde el Parque Kennedy, radio 1 km.
  const near=await api('/workshops?lat=-12.1211&lon=-77.0297&radiusKm=1',{token})
  assert.ok(near.data.count>=1)
  assert.ok(near.data.items.every(x=>x.distanceKm<=1))
  assert.ok(near.data.items.every((x,i,a)=>!i||a[i-1].distanceKm<=x.distanceKm))
  assert.equal((await api('/workshops?lat=200&lon=0',{token})).status,400)
}))

test('inicio de sesión obligatorio para ver talleres',async()=>withApi(async api=>{
  for (const path of ['/workshops','/workshops/t-1','/workshops/t-1/reviews','/recommendations','/instructors/tallerista-1'])
    assert.equal((await api(path)).status,401,path)
  assert.equal((await api('/health')).status,200)
  assert.equal((await api('/meta')).status,200)
}))

test('recordarme: sesión larga vs. sesión corta y cierre de sesión',async()=>withApi(async api=>{
  const short=await api('/auth/login',{method:'POST',body:{email:'cliente@hobbiz.pe',password:'Demo12345!'}})
  const long=await api('/auth/login',{method:'POST',body:{email:'cliente@hobbiz.pe',password:'Demo12345!',remember:true}})
  const days=(r)=>(Date.parse(r.data.expiresAt)-Date.now())/86400000
  assert.ok(days(short)<1, 'sin recordar dura horas')
  assert.ok(days(long)>29, 'recordado dura ~30 días')
  assert.equal((await api('/auth/me',{token:long.data.token})).status,200)
  assert.equal((await api('/auth/logout',{method:'POST',token:long.data.token})).status,204)
  assert.equal((await api('/auth/me',{token:long.data.token})).status,401)
  assert.equal((await api('/auth/login',{method:'POST',body:{email:'cliente@hobbiz.pe',password:'mala'}})).status,401)
  // Las fichas de talleres reales no tienen contraseña y no permiten iniciar sesión.
  assert.equal((await api('/auth/login',{method:'POST',body:{email:'',password:''}})).status,401)
}))

test('sesión expirada se rechaza',async()=>{
  const store=createSeedStore()
  store.sessions.set('vieja',{userId:'cliente-1',expiresAt:Date.now()-1000})
  const server=createApp(store).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r))
  try{
    const r=await fetch(`http://127.0.0.1:${server.address().port}/api/auth/me`,{headers:{Authorization:'Bearer vieja'}})
    assert.equal(r.status,401)
    assert.equal(store.sessions.has('vieja'),false)
  }finally{await new Promise(r=>server.close(r))}
})

test('registro, inicio de sesión, favoritos y preferencias',async()=>withApi(async api=>{
  const reg=await api('/auth/register',{method:'POST',body:{name:'Prueba Alumna',email:'prueba@example.com',password:'Segura123!',role:'client'}})
  assert.equal(reg.status,201)
  const token=reg.data.token
  assert.equal(reg.data.user.passwordHash,undefined)
  const fav=await api('/me/favorites/t-2',{method:'POST',token})
  assert.equal(fav.status,200)
  assert.ok((await api('/me/favorites',{token})).data.items.some(w=>w.id==='t-2'))
  const updated=await api('/me',{method:'PATCH',token,body:{preferences:{interests:['Arte'],budget:60,district:'Barranco',day:'sábado'}}})
  assert.equal(updated.data.user.preferences.budget,60)
  assert.equal((await api('/me/favorites/t-2',{method:'DELETE',token})).status,200)
  assert.equal((await api('/me/favorites',{token})).data.items.length,0)
}))

test('reservas actualizan cupos y previenen sobreventa',async()=>withApi(async api=>{
  const noToken=await api('/workshops/t-1/bookings',{method:'POST',body:{seats:1}})
  assert.equal(noToken.status,401)
  const token=(await client(api)).data.token
  const original=(await api('/workshops/t-1',{token})).data.item.available
  const booking=await api('/workshops/t-1/bookings',{method:'POST',token,body:{seats:1}})
  assert.equal(booking.status,201)
  assert.equal((await api('/workshops/t-1',{token})).data.item.available,original-1)
  const over=await api('/workshops/t-1/bookings',{method:'POST',token,body:{seats:10}})
  assert.equal(over.status,409)
  assert.ok((await api('/me/bookings',{token})).data.items.some(b=>b.id===booking.data.item.id))
}))

test('reseñas requieren reserva y actualizan el promedio',async()=>withApi(async api=>{
  const registration=await api('/auth/register',{method:'POST',body:{name:'Ana Rivera',email:'ana@example.com',password:'Pass12345',role:'client'}})
  const token=registration.data.token
  const denied=await api('/workshops/t-2/reviews',{method:'POST',token,body:{stars:5,comment:'Gran clase de pintura'}})
  assert.equal(denied.status,403)
  const book=await api('/workshops/t-2/bookings',{method:'POST',token,body:{seats:1}})
  assert.equal(book.status,201)
  const review=await api('/workshops/t-2/reviews',{method:'POST',token,body:{stars:5,comment:'Gran clase de pintura'}})
  assert.equal(review.status,201)
  const w=(await api('/workshops/t-2',{token})).data.item
  assert.equal(w.reviewCount,2)
  assert.equal(w.rating,4.5)
  assert.equal((await api('/workshops/t-2/reviews',{token})).data.items.length,2)
}))

const validWorkshop=()=>({ title:'Taller de mosaico', summary:'Explora el arte del mosaico decorativo.',description:'Durante esta sesión crearás una composición decorativa guiada paso a paso.',category:'Arte',price:50,district:'Barranco',venue:'Taller Mosaico',address:'Jr. Unión 120, Barranco',lat:-12.1478,lon:-77.0212,date:future(30),startsAt:'10:00',endsAt:'12:00',capacity:10,level:'Principiante',materialsIncluded:'Teselas y adhesivos',materialsBring:'Mandil',image:'/images/arte.jpg'})

test('tallerista solo puede publicar fichas completas y editar las suyas',async()=>withApi(async api=>{
  const token=(await instructor(api)).data.token
  assert.equal((await api('/instructor/dashboard',{token})).status,200)
  const invalid=await api('/instructor/workshops',{method:'POST',token,body:{title:'Incompleto'}})
  assert.equal(invalid.status,400)
  const valid=validWorkshop()
  const creation=await api('/instructor/workshops',{method:'POST',token,body:valid})
  assert.equal(creation.status,201)
  const id=creation.data.item.id
  const edit=await api(`/instructor/workshops/${id}`,{method:'PUT',token,body:{...valid,price:55}})
  assert.equal(edit.status,200)
  assert.equal(edit.data.item.price,55)
  assert.equal((await api('/instructor/workshops',{token})).data.items.length,4)
  const other=(await client(api)).data.token
  assert.equal((await api('/instructor/workshops',{token:other})).status,403)
  assert.equal((await api(`/instructor/workshops/w-mundodebarro`,{method:'PUT',token,body:{price:1}})).status,404)
  assert.equal((await api(`/instructor/workshops/${id}`,{method:'DELETE',token})).status,204)
}))

test('solo se aceptan talleres de Miraflores o Barranco con su punto en el mapa',async()=>withApi(async api=>{
  const token=(await instructor(api)).data.token
  const post=body=>api('/instructor/workshops',{method:'POST',token,body})
  assert.equal((await post({...validWorkshop(),district:'San Isidro'})).status,400)
  const noPin={...validWorkshop()};delete noPin.lat;delete noPin.lon
  assert.equal((await post(noPin)).status,400)
  // Pin en Miraflores pero distrito declarado Barranco.
  assert.match((await post({...validWorkshop(),lat:-12.1211,lon:-77.0297})).data.error,/dentro de Barranco/)
  // Pin fuera de ambos distritos (San Isidro).
  assert.equal((await post({...validWorkshop(),district:'Miraflores',lat:-12.0972,lon:-77.0356})).status,400)
  assert.equal((await post({...validWorkshop(),district:'Miraflores',address:'Av. Larco 400',lat:-12.1209,lon:-77.0296})).status,201)
}))

test('abrir/cerrar inscripciones y monto recaudado por taller',async()=>withApi(async api=>{
  const token=(await instructor(api)).data.token
  const buyer=(await client(api)).data.token
  assert.equal((await api('/instructor/workshops/t-3',{method:'PUT',token,body:{enrollmentOpen:false}})).status,200)
  const closed=await api('/workshops/t-3/bookings',{method:'POST',token:buyer,body:{seats:1}})
  assert.equal(closed.status,409)
  assert.match(closed.data.error,/cerró/)
  assert.equal((await api('/workshops/t-3',{token:buyer})).data.item.enrollmentOpen,false)
  assert.equal((await api('/instructor/workshops/t-3',{method:'PUT',token,body:{enrollmentOpen:true}})).status,200)
  assert.equal((await api('/workshops/t-3/bookings',{method:'POST',token:buyer,body:{seats:2}})).status,201)
  const dash=(await api('/instructor/dashboard',{token})).data
  const row=dash.byWorkshop.find(r=>r.id==='t-3')
  assert.equal(row.reserved,5)
  assert.equal(row.estimatedGross,5*40)
  assert.equal(dash.estimatedGross,dash.byWorkshop.reduce((s,r)=>s+r.estimatedGross,0))
  const regs=(await api('/instructor/bookings?workshopId=t-3',{token})).data.items
  assert.ok(regs.some(r=>r.studentName==='Alexis Castro' && r.seats===2))
}))

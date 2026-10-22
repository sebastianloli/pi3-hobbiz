import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.js'
import { createSeedStore } from '../src/data.js'

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

test('catálogo, búsqueda, categorías y cercanía funcionan',async()=>withApi(async api=>{
  const all=await api('/workshops')
  assert.equal(all.status,200)
  assert.equal(all.data.count,8)
  const filtered=await api('/workshops?category=Arte&district=Miraflores&maxPrice=50')
  assert.equal(filtered.data.count,1)
  assert.equal(filtered.data.items[0].id,'t-1')
  const nearby=await api('/workshops?near=Miraflores&radiusKm=5')
  assert.ok(nearby.data.items.length>=2)
  assert.ok(nearby.data.items.every(x=>x.distanceKm<=5))
}))

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
  const original=(await api('/workshops/t-1')).data.item.available
  const booking=await api('/workshops/t-1/bookings',{method:'POST',token,body:{seats:1}})
  assert.equal(booking.status,201)
  assert.equal((await api('/workshops/t-1')).data.item.available,original-1)
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
  assert.equal((await api('/workshops/t-2')).data.item.reviewCount,2)
}))

test('tallerista solo puede publicar fichas completas y editar las suyas',async()=>withApi(async api=>{
  const token=(await instructor(api)).data.token
  assert.equal((await api('/instructor/dashboard',{token})).status,200)
  const invalid=await api('/instructor/workshops',{method:'POST',token,body:{title:'Incompleto'}})
  assert.equal(invalid.status,400)
  const valid={ title:'Taller de mosaico', summary:'Explora el arte del mosaico decorativo.',description:'Durante esta sesión crearás una composición decorativa guiada paso a paso.',category:'Arte',price:50,district:'Pueblo Libre',venue:'Taller Mosaico',address:'Av. Sucre 540',date:'2026-11-21',startsAt:'10:00',endsAt:'12:00',capacity:10,level:'Principiante',materialsIncluded:'Teselas y adhesivos',materialsBring:'Mandil',image:'/images/arte.jpg'}
  const creation=await api('/instructor/workshops',{method:'POST',token,body:valid})
  assert.equal(creation.status,201)
  const id=creation.data.item.id
  const edit=await api(`/instructor/workshops/${id}`,{method:'PUT',token,body:{...valid,price:55}})
  assert.equal(edit.status,200)
  assert.equal(edit.data.item.price,55)
  assert.equal((await api('/instructor/workshops',{token})).data.items.length,4)
  const other=(await client(api)).data.token
  assert.equal((await api('/instructor/workshops',{token:other})).status,403)
  assert.equal((await api(`/instructor/workshops/${id}`,{method:'DELETE',token})).status,204)
}))

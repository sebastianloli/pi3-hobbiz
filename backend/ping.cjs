// Diagnóstico temporal de la conexión a Atlas (bórralo después).
require('dotenv').config({ path: __dirname + '/.env' })
const { MongoClient } = require('mongodb')
let uri = String(process.env.MONGODB_URI || '').trim().replace(/^["']|["']$/g, '')
uri = uri.replace('<db_password>', encodeURIComponent(process.env.MONGODB_PASSWORD || ''))
console.log('Node', process.version, '| host:', uri.split('@')[1]?.split('/')[0])
new MongoClient(uri, { serverSelectionTimeoutMS: 15000 }).connect()
  .then(async c => { console.log('✔ CONECTADO'); await c.close() })
  .catch(e => {
    console.log('✘', e.name, '-', e.message)
    for (const [host, s] of e.reason?.servers || []) console.log('  ', host, '→', s.error?.message || s.type)
  })
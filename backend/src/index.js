import { createApp } from './app.js'

const port = Number(process.env.PORT || 3001)
createApp().listen(port, '127.0.0.1', () => {
  console.log(`Hobbiz API: http://127.0.0.1:${port}/api/health`)
  console.log('Modo demo: los cambios viven en memoria y se reinician al parar el servidor.')
})

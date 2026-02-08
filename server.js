import Fastify from 'fastify'
import websocket from '@fastify/websocket'

const fastify = Fastify()
fastify.register(websocket)

fastify.get('/conversation', { websocket: true }, (connection) => {
  console.log('🔌 Twilio connecté')

  connection.socket.send(
    JSON.stringify({
      type: 'say',
      text: 'Bonjour. Je vais vous poser quelques questions.'
    })
  )

  connection.socket.on('message', (message) => {
    console.log('📥 Message reçu :', message.toString())
  })

  connection.socket.on('close', () => {
    console.log('❌ Connexion fermée')
  })
})

fastify.listen({
  port: process.env.PORT || 3000,
  host: '0.0.0.0'
})

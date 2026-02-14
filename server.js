import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import formbody from '@fastify/formbody'

const start = async () => {

  const fastify = Fastify({ logger: true })

  await fastify.register(formbody)
  await fastify.register(websocket)

  // =========================
  // ROUTE VOICE (Twilio)
  // =========================
  fastify.post('/voice', async (request, reply) => {

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="fr-FR">
    Bonjour. Le standard IA est maintenant actif.
  </Say>
</Response>`

    reply.type('text/xml').send(twiml)
  })

  // =========================
  // ROUTE WEBSOCKET (future IA temps réel)
  // =========================
  fastify.get('/conversation', { websocket: true }, (connection) => {
    console.log('WebSocket connecté')

    connection.socket.on('message', message => {
      console.log('Message reçu:', message.toString())
    })
  })

  const PORT = process.env.PORT || 3000

  await fastify.listen({
    port: PORT,
    host: '0.0.0.0'
  })

  console.log(`🚀 Serveur lancé sur ${PORT}`)
}

start()

import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import formbody from '@fastify/formbody'

const fastify = Fastify({ logger: true })

await fastify.register(formbody)
await fastify.register(websocket)

// ✅ ROUTES APRÈS initialisation

fastify.get('/conversation', { websocket: true }, (connection, req) => {
  console.log('WebSocket connecté')

  connection.socket.on('message', message => {
    console.log('Message reçu:', message.toString())
  })
})

fastify.post('/voice', async (request, reply) => {

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="fr-FR">
    Bonjour. Le standard IA est maintenant actif.
  </Say>
</Response>`

  reply.type('text/xml').send(twiml)
})

// ✅ LANCEMENT À LA FIN

const PORT = process.env.PORT || 3000

await fastify.listen({
  port: PORT,
  host: '0.0.0.0'
})

console.log(`🚀 Serveur lancé sur ${PORT}`)

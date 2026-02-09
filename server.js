import Fastify from 'fastify'
import websocket from '@fastify/websocket'

const fastify = Fastify({ logger: true })

await fastify.register(websocket)

/**
 * Route WebSocket (pour plus tard – OK de la garder)
 */
fastify.get('/conversation', { websocket: true }, (connection) => {
  console.log('🔌 WebSocket connecté')

  connection.socket.send(
    JSON.stringify({
      type: 'say',
      text: 'Bonjour. Je vais vous poser quelques questions.'
    })
  )

  connection.socket.on('message', (message) => {
    console.log('📩 Message reçu :', message.toString())
  })

  connection.socket.on('close', () => {
    console.log('❌ Connexion WebSocket fermée')
  })
})

/**
 * ✅ ROUTE VOICE — CELLE QUE TWILIO APPELLE
 */
fastify.post('/voice', async (request, reply) => {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="fr-FR">
    Bonjour. Le standard IA est maintenant actif.
  </Say>
</Response>`

  reply
    .header('Content-Type', 'text/xml')
    .send(twiml)
})

/**
 * Lancement serveur (OBLIGATOIRE pour Railway)
 */
const port = process.env.PORT || 3000

await fastify.listen({
  port,
  host: '0.0.0.0'
})

console.log(`🚀 Serveur lancé sur le port ${port}`)

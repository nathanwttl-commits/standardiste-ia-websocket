import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import formbody from '@fastify/formbody'

const fastify = Fastify({ logger: true })

// 🔹 IMPORTANT pour Twilio
await fastify.register(formbody)

// 🔹 WebSocket (pour plus tard)
await fastify.register(websocket)

// =============================
// ROUTE /voice (Twilio appelle ici)
// =============================
fastify.post('/voice', async (request, reply) => {

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="fr-FR">
    Bonjour. Le standard IA est maintenant actif.
  </Say>
</Response>`

  reply
    .type('text/xml')
    .send(twiml)
})

// =============================
// Lancement serveur (OBLIGATOIRE Railway)
// =============================
const PORT = process.env.PORT || 3000

await fastify.listen({
  port: PORT,
  host: '0.0.0.0'
})

console.log(`🚀 Serveur lancé sur le port ${PORT}`)

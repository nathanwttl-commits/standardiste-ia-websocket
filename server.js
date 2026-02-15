import Fastify from 'fastify'
import formbody from '@fastify/formbody'

const fastify = Fastify({ logger: true })

await fastify.register(formbody)


// ============================
// ROUTE /voice
// ============================

fastify.post('/voice', async (request, reply) => {

  const twiml = `
  <Response>
    <Gather input="speech" action="/conversation" method="POST" speechTimeout="auto">
      <Say voice="alice" language="fr-FR">
        Bonjour. Comment puis-je vous aider ?
      </Say>
    </Gather>
    <Say>Je n'ai pas compris. Pouvez-vous répéter ?</Say>
    <Redirect>/voice</Redirect>
  </Response>
  `

  reply.type('text/xml').send(twiml)
})


// ============================
// ROUTE /conversation
// ============================

fastify.post('/conversation', async (request, reply) => {

  const userSpeech = request.body.SpeechResult || "Aucune réponse détectée"

  console.log("🎤 Utilisateur :", userSpeech)

  // 👉 POUR L'INSTANT on simule Make
  // Plus tard on branchera le webhook Make ici

  let iaResponse = "Merci. Je traite votre demande."

  if (userSpeech.toLowerCase().includes("rendez-vous")) {
    iaResponse = "Très bien. Pour quel jour souhaitez-vous prendre rendez-vous ?"
  }

  const twiml = `
  <Response>
    <Gather input="speech" action="/conversation" method="POST" speechTimeout="auto">
      <Say voice="alice" language="fr-FR">
        ${iaResponse}
      </Say>
    </Gather>
  </Response>
  `

  reply.type('text/xml').send(twiml)
})


// ============================
// LANCEMENT
// ============================

const PORT = process.env.PORT || 3000

await fastify.listen({
  port: PORT,
  host: '0.0.0.0'
})

console.log(`🚀 Serveur lancé sur ${PORT}`)

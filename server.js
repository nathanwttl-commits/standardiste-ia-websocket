import Fastify from 'fastify'
import formbody from '@fastify/formbody'

const fastify = Fastify({ logger: true })

await fastify.register(formbody)


// =====================================================
// ROUTE /voice  (entrée appel)
// =====================================================

fastify.post('/voice', async (request, reply) => {

  const twiml = `
<Response>
  <Gather 
    input="speech"
    action="/conversation"
    method="POST"
    timeout="5"
    speechTimeout="2"
    bargeIn="false"
    language="fr-FR"
  >
    <Say voice="Polly.Celine" language="fr-FR">
      Bonjour. Comment puis-je vous aider ?
    </Say>
  </Gather>

  <Say voice="Polly.Celine" language="fr-FR">
    Je n'ai pas compris. Pouvez-vous répéter ?
  </Say>

  <Redirect>/voice</Redirect>
</Response>
  `

  reply.type('text/xml').send(twiml)
})


// =====================================================
// ROUTE /conversation  (analyse réponse utilisateur)
// =====================================================

fastify.post('/conversation', async (request, reply) => {

  const userSpeech = request.body.SpeechResult || ""
  const confidence = request.body.Confidence || 0

  console.log("🎤 Utilisateur :", userSpeech)
  console.log("📊 Confiance :", confidence)

  // 🔒 Filtrage anti-bruit
  if (!userSpeech || confidence < 0.60) {
    const retryTwiml = `
<Response>
  <Gather 
    input="speech"
    action="/conversation"
    method="POST"
    timeout="5"
    speechTimeout="2"
    language="fr-FR"
  >
    <Say voice="Polly.Celine" language="fr-FR">
      Je n'ai pas bien entendu. Pouvez-vous reformuler votre demande ?
    </Say>
  </Gather>
</Response>
    `
    return reply.type('text/xml').send(retryTwiml)
  }

  // =====================================================
  // 🔵 ICI PLUS TARD → Appel webhook MAKE
  // =====================================================

  let iaResponse = "Je m'occupe de votre demande."

  if (userSpeech.toLowerCase().includes("rendez")) {
    iaResponse = "Très bien. Pour quel jour souhaitez-vous prendre rendez-vous ?"
  }

  if (userSpeech.toLowerCase().includes("expert")) {
    iaResponse = "Je vérifie l'état du dossier avec l'expert. Un instant."
  }

  if (userSpeech.toLowerCase().includes("devis")) {
    iaResponse = "Souhaitez-vous planifier un rendez-vous pour établir un devis ?"
  }

  // =====================================================
  // Réponse + boucle
  // =====================================================

  const twiml = `
<Response>
  <Gather 
    input="speech"
    action="/conversation"
    method="POST"
    timeout="5"
    speechTimeout="2"
    language="fr-FR"
  >
    <Say voice="Polly.Celine" language="fr-FR">
      ${iaResponse}
    </Say>
  </Gather>

  <Say voice="Polly.Celine" language="fr-FR">
    Je reste à votre écoute.
  </Say>

  <Redirect>/conversation</Redirect>
</Response>
  `

  reply.type('text/xml').send(twiml)
})


// =====================================================
// LANCEMENT SERVEUR
// =====================================================

const PORT = process.env.PORT || 3000

await fastify.listen({
  port: PORT,
  host: '0.0.0.0'
})

console.log(`🚀 Serveur lancé sur ${PORT}`)

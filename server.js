import Fastify from 'fastify'
import formbody from '@fastify/formbody'

const start = async () => {

  const fastify = Fastify({ logger: true })
  await fastify.register(formbody)

  // =========================
  // ROUTE /voice
  // =========================
  fastify.post('/voice', async (request, reply) => {

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>

  <Gather 
    input="speech"
    action="/conversation"
    method="POST"
    timeout="5"
    speechTimeout="auto"
    language="fr-FR">

    <Say voice="Polly.Celine" language="fr-FR">
      Carrosserie. Assistant de réception. Quelle est votre demande ?
    </Say>

  </Gather>

  <Say voice="Polly.Celine" language="fr-FR">
    Je n'ai pas compris. Pouvez-vous répéter ?
  </Say>

  <Redirect method="POST">/voice</Redirect>

</Response>`

    reply.type('text/xml').send(twiml)
  })

  // =========================
  // ROUTE /conversation
  // =========================
  fastify.post('/conversation', async (request, reply) => {

    const userSpeech = request.body.SpeechResult || ""
    const confidence = parseFloat(request.body.Confidence || 0)
    const phone = request.body.From || ""

    console.log("Utilisateur :", userSpeech)
    console.log("Confiance :", confidence)

    // Filtre anti-bruit
    if (!use

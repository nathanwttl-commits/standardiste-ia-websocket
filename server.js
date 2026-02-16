import Fastify from 'fastify'
import formbody from '@fastify/formbody'

const fastify = Fastify({ logger: true })
await fastify.register(formbody)

const MAKE_WEBHOOK = process.env.MAKE_WEBHOOK_URL
const TRANSFER_NUMBER = process.env.TRANSFER_NUMBER

// ================= ROUTE /voice =================

fastify.post('/voice', async (request, reply) => {

  const twiml = `
<Response>
  <Gather 
    input="speech"
    action="/conversation"
    method="POST"
    timeout="6"
    speechTimeout="auto"
    language="fr-FR"
  >
    <Say voice="Polly.Celine" language="fr-FR">
      Bonjour. Comment puis-je vous aider ?
    </Say>
  </Gather>
</Response>
  `

  reply.type('text/xml').send(twiml)
})

// ================= ROUTE /conversation =================

fastify.post('/conversation', async (request, reply) => {

  const transcript = request.body.SpeechResult || ""
  const confidence = parseFloat(request.body.Confidence || 0)

  console.log("Transcript:", transcript)
  console.log("Confidence:", confidence)
  console.log("MAKE_WEBHOOK:", MAKE_WEBHOOK)

  if (!transcript || confidence < 0.45) {
    return reply.type('text/xml').send(`
<Response>
  <Gather input="speech" action="/conversation" method="POST" language="fr-FR" speechTimeout="auto">
    <Say voice="Polly.Celine" language="fr-FR">
      Je n'ai pas bien entendu. Pouvez-vous reformuler ?
    </Say>
  </Gather>
</Response>
`)
  }

  let makeData = null

  try {

    const response = await fetch(MAKE_WEBHOOK, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ transcript })
    })

    console.log("Make status:", response.status)

    makeData = await response.json()

    console.log("Make JSON:", makeData)

  } catch (error) {
    console.error("MAKE ERROR:", error)
  }

  if (!makeData) {
    return reply.type('text/xml').send(`
<Response>
  <Say voice="Polly.Celine" language="fr-FR">
    Une erreur technique est survenue. Je vous transfère.
  </Say>
  <Dial>${TRANSFER_NUMBER}</Dial>
</Response>
`)
  }

  if (makeData.transfer === true) {
    return reply.type('text/xml').send(`
<Response>
  <Say voice="Polly.Celine" language="fr-FR">
    Pour mieux répondre à votre demande, je vous transfère.
  </Say>
  <Dial>${TRANSFER_NUMBER}</Dial>
</Response>
`)
  }

  return reply.type('text/xml').send(`
<Response>
  <Gather input="speech" action="/conversation" method="POST" language="fr-FR" speechTimeout="auto">
    <Say voice="Polly.Celine" language="fr-FR">
      ${makeData.message || "Je reste à votre écoute."}
    </Say>
  </Gather>
</Response>
`)
})

// ================= START =================

const PORT = process.env.PORT || 3000

fastify.listen({ port: PORT, host: '0.0.0.0' })
  .then(() => console.log("Server running"))
  .catch(err => {
    console.error(err)
    process.exit(1)
  })


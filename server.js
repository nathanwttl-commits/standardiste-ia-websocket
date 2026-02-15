import Fastify from 'fastify'
import formbody from '@fastify/formbody'

const fastify = Fastify({ logger: true })

await fastify.register(formbody)

// ===============================
// ENV VARIABLES
// ===============================

const MAKE_WEBHOOK = process.env.MAKE_WEBHOOK_URL
const TRANSFER_NUMBER = process.env.TRANSFER_NUMBER

// ===============================
// ROUTE /voice
// ===============================

fastify.post('/voice', async (request, reply) => {

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

// ===============================
// ROUTE /conversation
// ===============================

fastify.post('/conversation', async (request, reply) => {

  const transcript = request.body.SpeechResult || ""
  const confidence = parseFloat(request.body.Confidence || 0)
  const callSid = request.body.CallSid || ""

  console.log("===== NEW CALL TURN =====")
  console.log("Transcript:", transcript)
  console.log("Confidence:", confidence)
  console.log("CallSid:", callSid)
  console.log("MAKE_WEBHOOK:", MAKE_WEBHOOK)

  // Filtrage confiance
  if (!transcript || confidence < 0.6) {
    const retry = `
<Response>
  <Gather input="speech" action="/conversation" method="POST" language="fr-FR">
    <Say voice="Polly.Celine" language="fr-FR">
      Je n'ai pas bien entendu. Pouvez-vous reformuler ?
    </Say>
  </Gather>
</Response>`
    return reply.type('text/xml').send(retry)
  }

  // ===============================
  // CALL MAKE
  // ===============================

  let makeResponse = null

  try {

    console.log("=== CALLING MAKE ===")

    const response = await fetch(MAKE_WEBHOOK, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        transcript,
        callSid
      })
    })

    console.log("Make HTTP status:", response.status)

    makeResponse = await response.json()

    console.log("Make response JSON:", makeResponse)

  } catch (error) {
    console.error("MAKE ERROR:", error)
  }

  // ===============================


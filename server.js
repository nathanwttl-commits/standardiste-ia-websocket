import Fastify from 'fastify'
import formbody from '@fastify/formbody'
import { request } from 'undici'

const fastify = Fastify({ logger: true })

await fastify.register(formbody)

const PORT = process.env.PORT || 3000
const MAKE_WEBHOOK = process.env.MAKE_WEBHOOK_URL
const MAKE_API_KEY = process.env.MAKE_API_KEY
const TRANSFER_NUMBER = process.env.TRANSFER_NUMBER

const sessions = new Map()

// ================= VOICE =================

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
  <Redirect>/voice</Redirect>
</Response>
  `.trim()

  reply.type('text/xml').send(twiml)
})

// ================= CONVERSATION =================

fastify.post('/conversation', async (request, reply) => {

  const userSpeech = request.body.SpeechResult || ""
  const confidence = parseFloat(request.body.Confidence || 0)
  const callSid = request.body.CallSid

  console.log("Speech:", userSpeech)
  console.log("Confidence:", confidence)

  if (!userSpeech || confidence < 0.45) {
    return reply.type('text/xml').send(generateRetry())
  }

  if (!sessions.has(callSid)) {
    sessions.set(callSid, {
      step: "identify",
      immat: null,
      immatConfirmed: false,
      correctionCount: 0
    })
  }

  const state = sessions.get(callSid)

  let makeResponse

  try {

    const { body } = await request(MAKE_WEBHOOK, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-make-apikey': MAKE_API_KEY
      },
      body: JSON.stringify({
        transcript: userSpeech,
        callSid,
        state
      })
    })

    makeResponse = await body.json()

  } catch (error) {
    console.error("Make error:", error)
    return reply.type('text/xml').send(generateTransfer())
  }

  if (!makeResponse || typeof makeResponse !== "object") {
    return reply.type('text/xml').send(generateTransfer())
  }

  if (makeResponse.updated_state) {
    sessions.set(callSid, makeResponse.updated_state)
  }

  if (makeResponse.transfer) {
    return reply.type('text/xml').send(generateTransfer(makeResponse.message))
  }

  if (makeResponse.end_call) {
    return reply.type('text/xml').send(generateHangup(makeResponse.message))
  }

  return reply.type('text/xml').send(generateGather(makeResponse.message))
})

// ================= UTILITAIRES =================

function generateGather(message) {
  return `
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
      ${message}
    </Say>
  </Gather>
</Response>
  `.trim()
}

function generateRetry() {
  return `
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
      Je n'ai pas bien entendu. Pouvez-vous reformuler ?
    </Say>
  </Gather>
</Response>
  `.trim()
}

function generateTransfer(message = "Afin de vous apporter une réponse adaptée, je vous transfère immédiatement à un responsable.") {
  return `
<Response>
  <Say voice="Polly.Celine" language="fr-FR">
    ${message}
  </Say>
  <Dial>${TRANSFER_NUMBER}</Dial>
</Response>
  `.trim()
}

function generateHangup(message) {
  return `
<Response>
  <Say voice="Polly.Celine" language="fr-FR">
    ${message}
  </Say>
  <Hangup/>
</Response>
  `.trim()
}

await fastify.listen({
  port: PORT,
  host: '0.0.0.0'
})

console.log("Server started")


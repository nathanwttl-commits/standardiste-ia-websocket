import Fastify from 'fastify'
import formbody from '@fastify/formbody'

const fastify = Fastify({ logger: true })

await fastify.register(formbody)

const PORT = process.env.PORT || 3000
const MAKE_WEBHOOK = process.env.MAKE_WEBHOOK_URL
const MAKE_API_KEY = process.env.MAKE_API_KEY
const TRANSFER_NUMBER = process.env.TRANSFER_NUMBER

const sessions = new Map()

// =====================================================
// ROUTE /voice
// =====================================================

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

// =====================================================
// ROUTE /conversation
// =====================================================

fastify.post('/conversation', async (request, reply) => {

  const userSpeech = request.body.SpeechResult || ""
  const confidence = parseFloat(request.body.Confidence || 0)
  const callSid = request.body.CallSid

  console.log("🎤 SpeechResult:", userSpeech)
  console.log("📊 Confidence:", confidence)

  // 🔒 Filtrage anti-bruit ajusté
  if (!userSpeech || confidence < 0.45) {
    return reply.type('text/xml').send(generateRetry())
  }

  // 🧠 Initialisation session
  if (!sessions.has(callSid)) {
    sessions.set(callSid, {
      step: "identify",
      immat: null,
      immatConfirmed: false,
      correctionCount: 0
    })
  }

  const state = sessions.get(callSid)

  // =====================================================
  // Appel MAKE
  // =====================================================

  let makeResponse

  try {

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4000)

    const response = await fetch(MAKE_WEBHOOK, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-make-apikey": MAKE_API_KEY
      },
      body: JSON.stringify({
        transcript: userSpeech,
        callSid,
        state
      }),
      signal: controller.signal
    })

    clearTimeout(timeout)

    makeResponse = await response.json()

  } catch (error) {
    console.error("❌ Erreur Make:", error)
    return reply.type('text/xml').send(generateTransfer())
  }

  // 🔒 Sécurité JSON
  if (!makeResponse || typeof makeResponse !== "object") {
    return reply.type('text/xml').send(generateTransfer())
  }

  // 🔄 Mise à jour state
  if (makeResponse.updated_state) {
    sessions.set(callSid, makeResponse.updated_state)
  }

  // 🔴 Transfert
  if (makeResponse.transfer) {
    return reply.type('text/xml').send(generateTransfer(makeResponse.message))
  }

  // 🔚 Fin appel
  if (makeResponse.end_call) {
    return reply.type('text/xml').send(generateHangup(makeResponse.message))
  }

  // 🟢 Réponse normale + boucle
  return reply.type('text/xml').send(generateGather(makeResponse.message))

})

// =====================================================
// Fonctions TwiML
// =====================================================

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
    action=

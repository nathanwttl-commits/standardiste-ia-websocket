import Fastify from 'fastify'
import formbody from '@fastify/formbody'

const fastify = Fastify({ logger: true })
await fastify.register(formbody)

// ==========================
// Mémoire temporaire par appel
// ==========================
const sessions = {}

// ==========================
// ROUTE /voice
// ==========================
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
  <Redirect method="POST">/voice</Redirect>
</Response>`

  reply.type('text/xml').send(twiml)
})

// ==========================
// ROUTE /conversation
// ==========================
fastify.post('/conversation', async (request, reply) => {

  const userSpeech = request.body.SpeechResult || ""
  const confidence = parseFloat(request.body.Confidence || 0)
  const phone = request.body.From || ""
  const callSid = request.body.CallSid

  console.log("Utilisateur :", userSpeech)
  console.log("Confiance :", confidence)

  if (!sessions[callSid]) {
    sessions[callSid] = { step: "initial" }
  }

  if (!userSpeech || confidence < 0.6) {
    return reply.type('text/xml').send(`
<Response>
  <Say voice="Polly.Celine" language="fr-FR">
    Je n'ai pas bien entendu. Pouvez-vous reformuler ?
  </Say>
  <Redirect method="POST">/voice</Redirect>
</Response>`)
  }

  try {

    // ==========================
    // SI on attend une immatriculation
    // ==========================
    if (sessions[callSid].step === "waiting_immat") {

      const immat = userSpeech

      const makeResponse = await fetch("https://hook.eu1.make.com/eombd2fwis2ker13qun48oq2g8yymdvy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: "suivi_reparation",
          immat: immat,
          phone: phone
        })
      })

      const makeData = await makeResponse.json()

      sessions[callSid].step = "done"

      return reply.type('text/xml').send(`
<Response>
  <Say voice="Polly.Celine" language="fr-FR">
    ${makeData.reply}
  </Say>
</Response>`)
    }

    // ==========================
    // Étape initiale → Analyse intent
    // ==========================
    const makeResponse = await fetch("https://hook.eu1.make.com/eombd2fwis2ker13qun48oq2g8yymdvy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        speech: userSpeech,
        phone: phone
      })
    })

    const makeData = await makeResponse.json()

    const intent = makeData.intent
    const immat = makeData.entities?.immat || ""

    // ==========================
    // Cas : suivi réparation sans immat
    // ==========================
    if (intent === "suivi_reparation" && !immat) {

      sessions[callSid].step = "waiting_immat"

      return reply.type('text/xml').send(`
<Response>
  <Gather input="speech" action="/conversation" method="POST" language="fr-FR">
    <Say voice="Polly.Celine" language="fr-FR">
      Pouvez-vous me communiquer votre immatriculation s'il vous plaît ?
    </Say>
  </Gather>
</Response>`)
    }

    // ==========================
    // Cas : réponse automatique
    // ==========================
    if (makeData.action === "respond") {

      sessions[callSid].step = "done"

      return reply.type('text/xml').send(`
<Response>
  <Say voice="Polly.Celine" language="fr-FR">
    ${makeData.reply}
  </Say>
</Response>`)
    }

    // ==========================
    // Cas : transfert
    // ==========================
    sessions[callSid].step = "done"

    return reply.type('text/xml').send(`
<Response>
  <Say voice="Polly.Celine" language="fr-FR">
    ${makeData.reply || "Je vous transfère pour un suivi personnalisé."}
  </Say>
  <Dial>+33769170012</Dial>
</Response>`)

  } catch (error) {

    console.error("Erreur :", error)

    return reply.type('text/xml').send(`
<Response>
  <Say voice="Polly.Celine" language="fr-FR">
    Je vous transfère à la réception.
  </Say>
  <Dial>+33769170012</Dial>
</Response>`)
  }

})

// ==========================
// LANCEMENT SERVEUR
// ==========================
const PORT = process.env.PORT || 3000

await fastify.listen({
  port: PORT,
  host: '0.0.0.0'
})

console.log("Serveur lancé")

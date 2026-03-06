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

  if (!sessions[callSid]) {
    sessions[callSid] = {
      step: "initial",
      attempt: 0
    }
  }

  const session = sessions[callSid]


  // ==========================
  // Si Twilio n'a rien compris
  // ==========================
  if (!userSpeech || confidence < 0.6) {

    if (session.step === "waiting_identifiant") {

      return reply.type('text/xml').send(`
<Response>
  <Gather input="speech" action="/conversation" method="POST" timeout="5" speechTimeout="auto" language="fr-FR">
    <Say voice="Polly.Celine" language="fr-FR">
      Je n'ai pas bien compris votre immatriculation. Pouvez-vous la répéter s'il vous plaît ?
    </Say>
  </Gather>
</Response>`)

    }

    return reply.type('text/xml').send(`
<Response>
  <Say voice="Polly.Celine" language="fr-FR">
    Je n'ai pas bien entendu. Pouvez-vous reformuler ?
  </Say>
  <Redirect method="POST">/voice</Redirect>
</Response>`)
  }


  try {

    const makeResponse = await fetch("https://hook.eu1.make.com/eombd2fwis2ker13qun48oq2g8yymdvy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        speech: userSpeech,
        phone: phone,
        callSid: callSid,
        step: session.step,
        attempt: session.attempt
      })
    })

    if (!makeResponse.ok) {
      throw new Error("Erreur HTTP Make")
    }

    const makeData = await makeResponse.json()


    // ==========================
    // Sécurisation réponse Make
    // ==========================
    if (!makeData) {
      throw new Error("Réponse Make vide")
    }

    const action = makeData.action || "joker"
    const replyText = makeData.reply || "Pouvez-vous reformuler votre demande ?"


    // ==========================
    // ACTION : DEMANDE IDENTIFIANT
    // ==========================
    if (action === "ask_identifiant") {

      session.step = "waiting_identifiant"
      session.attempt = 1

      return reply.type('text/xml').send(`
<Response>
  <Gather input="speech" action="/conversation" method="POST" timeout="5" speechTimeout="auto" language="fr-FR">
    <Say voice="Polly.Celine" language="fr-FR">
      ${replyText}
    </Say>
  </Gather>
</Response>`)
    }


    // ==========================
    // ACTION : JOKER
    // ==========================
    if (action === "joker") {

      if (session.attempt >= 1) {

        session.step = "done"

        return reply.type('text/xml').send(`
<Response>
  <Say voice="Polly.Celine" language="fr-FR">
    Je vous transfère à la réception pour un suivi personnalisé.
  </Say>
  <Dial>+33769170012</Dial>
</Response>`)
      }

      session.attempt += 1

      return reply.type('text/xml').send(`
<Response>
  <Gather input="speech" action="/conversation" method="POST" timeout="5" speechTimeout="auto" language="fr-FR">
    <Say voice="Polly.Celine" language="fr-FR">
      ${replyText}
    </Say>
  </Gather>
</Response>`)
    }


    // ==========================
    // ACTION : RESPOND
    // ==========================
    if (action === "respond") {

      session.step = "done"

      return reply.type('text/xml').send(`
<Response>
  <Say voice="Polly.Celine" language="fr-FR">
    ${replyText}
  </Say>
</Response>`)
    }


    // ==========================
    // ACTION : TRANSFER
    // ==========================
    if (action === "transfer") {

      session.step = "done"

      return reply.type('text/xml').send(`
<Response>
  <Say voice="Polly.Celine" language="fr-FR">
    ${replyText}
  </Say>
  <Dial>+33769170012</Dial>
</Response>`)
    }


    throw new Error("Action inconnue")


  } catch (error) {

    console.error("Erreur sécurisée :", error)

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

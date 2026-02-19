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
    if (!userSpeech || confidence < 0.6) {

      const retryTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>

  <Gather 
    input="speech"
    action="/conversation"
    method="POST"
    timeout="5"
    speechTimeout="auto"
    language="fr-FR">

    <Say voice="Polly.Celine" language="fr-FR">
      Je n'ai pas bien entendu. Pouvez-vous reformuler ?
    </Say>

  </Gather>

</Response>`

      return reply.type('text/xml').send(retryTwiml)
    }

    try {

      // 🔥 Appel vers Make
      const makeResponse = await fetch("TON_URL_WEBHOOK_MAKE", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          speech: userSpeech,
          phone: phone
        })
      })

      const makeData = await makeResponse.json()

      const responseText = makeData.reply || "Je vous transfère à la réception."
      const action = makeData.action || "transfer"

      // =====================
      // ACTION : TRANSFER
      // =====================
      if (action === "transfer") {

        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Celine" language="fr-FR">
    ${responseText}
  </Say>
  <Dial>06XXXXXXXX</Dial>
</Response>`

        return reply.type('text/xml').send(twiml)
      }

      // =====================
      // ACTION : RESPOND
      // =====================
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Celine" language="fr-FR">
    ${responseText}
  </Say>
</Response>`

      return reply.type('text/xml').send(twiml)

    } catch (error) {

      console.error("Erreur Make :", error)

      // Fallback sécurité
      const fallbackTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Celine" language="fr-FR">
    Je vous transfère à la réception.
  </Say>
  <Dial>06XXXXXXXX</Dial>
</Response>`

      return reply.type('text/xml').send(fallbackTwiml)
    }

  })

  // =========================
  // LANCEMENT
  // =========================
  const PORT = process.env.PORT || 3000

  await fastify.listen({
    port: PORT,
    host: '0.0.0.0'
  })

  console.log(`Serveur lancé sur ${PORT}`)
}

start()

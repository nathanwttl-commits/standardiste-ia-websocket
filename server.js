fastify.post('/conversation', async (request, reply) => {

  const transcript = request.body.SpeechResult || ""
  const callSid = request.body.CallSid || ""

  console.log("===== NEW TURN =====")
  console.log("Transcript:", transcript)
  console.log("MAKE_WEBHOOK:", MAKE_WEBHOOK)

  // Si vraiment rien n'a été entendu
  if (!transcript) {
    return reply.type('text/xml').send(`
<Response>
  <Gather input="speech" action="/conversation" method="POST" language="fr-FR">
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
      body: JSON.stringify({
        transcript,
        callSid
      })
    })

    const raw = await response.text()
    console.log("RAW MAKE RESPONSE:", raw)

    makeData = JSON.parse(raw)

  } catch (err) {
    console.error("MAKE ERROR:", err)

    return reply.type('text/xml').send(`
<Response>
  <Say voice="Polly.Celine" language="fr-FR">
    Une erreur technique est survenue. Je vous transfère à un responsable.
  </Say>
  <Dial>${TRANSFER_NUMBER}</Dial>
</Response>
`)
  }

  const message = makeData?.message || "Je vous écoute."
  const transfer = makeData?.transfer || false
  const endCall = makeData?.end_call || false

  if (transfer) {
    return reply.type('text/xml').send(`
<Response>
  <Say voice="Polly.Celine" language="fr-FR">
    Pour mieux répondre à votre demande, je vous transfère à un responsable.
  </Say>
  <Dial>${TRANSFER_NUMBER}</Dial>
</Response>
`)
  }

  if (endCall) {
    return reply.type('text/xml').send(`
<Response>
  <Say voice="Polly.Celine" language="fr-FR">
    ${message}
  </Say>
  <Hangup/>
</Response>
`)
  }

  return reply.type('text/xml').send(`
<Response>
  <Gather input="speech" action="/conversation" method="POST" language="fr-FR">
    <Say voice="Polly.Celine" language="fr-FR">
      ${message}
    </Say>
  </Gather>
</Response>
`)
})

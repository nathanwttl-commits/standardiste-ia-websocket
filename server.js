import Fastify from 'fastify'
import formbody from '@fastify/formbody'

const fastify = Fastify({ logger: true })
await fastify.register(formbody)

const sessions = {}

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

fastify.post('/conversation', async (request, reply) => {

const userSpeech = request.body.SpeechResult || ""
const confidence = parseFloat(request.body.Confidence || 0)
const phone = request.body.From || ""
const callSid = request.body.CallSid

if (!sessions[callSid]) {

sessions[callSid] = {
step: "initial",
attempt: 0,
last_plate: null
}

}

const session = sessions[callSid]

if (!userSpeech || confidence < 0.6) {

return reply.type('text/xml').send(`
<Response>

<Gather
input="speech"
action="/conversation"
method="POST"
timeout="6"
speechTimeout="auto"
language="fr-FR">

<Say voice="Polly.Celine" language="fr-FR">
Je n'ai pas bien entendu. Pouvez-vous reformuler ?
</Say>

</Gather>

</Response>`)

}

try {

const makeResponse = await fetch("https://hook.eu1.make.com/eombd2fwis2ker13qun48oq2g8yymdvy", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
speech: userSpeech,
phone: phone,
step: session.step,
attempt: session.attempt
})
})

if (!makeResponse.ok) throw new Error("Erreur HTTP Make")

const makeData = await makeResponse.json()

if (!makeData || !makeData.reply || !makeData.action) {
throw new Error("Réponse Make invalide")
}

if (makeData.action === "ask_identifiant") {

session.step = "waiting_identifiant"
session.attempt = 1

return reply.type('text/xml').send(`
<Response>

<Gather
input="speech"
action="/conversation"
method="POST"
timeout="6"
speechTimeout="auto"
language="fr-FR">

<Say voice="Polly.Celine" language="fr-FR">
${makeData.reply}
</Say>

</Gather>

</Response>`)

}

if (makeData.action === "confirm_plate") {

session.step = "waiting_confirmation"
session.last_plate = makeData.plate

return reply.type('text/xml').send(`
<Response>

<Gather
input="speech"
action="/conversation"
method="POST"
timeout="5"
speechTimeout="auto"
language="fr-FR">

<Say voice="Polly.Celine" language="fr-FR">
Vous avez dit ${makeData.plate}. Est-ce correct ?
</Say>

</Gather>

</Response>`)

}

if (session.step === "waiting_confirmation") {

const answer = userSpeech.toLowerCase()

if (answer.includes("oui")) {

session.step = "confirmed"

return reply.type('text/xml').send(`
<Response>

<Say voice="Polly.Celine" language="fr-FR">
Merci. Je recherche votre dossier.
</Say>

<Redirect method="POST">/voice</Redirect>

</Response>`)

}

if (answer.includes("non")) {

session.step = "waiting_identifiant"

return reply.type('text/xml').send(`
<Response>

<Gather
input="speech"
action="/conversation"
method="POST"
timeout="6"
speechTimeout="auto"
language="fr-FR">

<Say voice="Polly.Celine" language="fr-FR">
Très bien. Pouvez-vous me redonner votre immatriculation ?
</Say>

</Gather>

</Response>`)

}

}

if (makeData.action === "respond") {

session.step = "done"

return reply.type('text/xml').send(`
<Response>

<Say voice="Polly.Celine" language="fr-FR">
${makeData.reply}
</Say>

</Response>`)

}

if (makeData.action === "transfer") {

session.step = "done"

return reply.type('text/xml').send(`
<Response>

<Say voice="Polly.Celine" language="fr-FR">
${makeData.reply}
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

const PORT = process.env.PORT || 3000

await fastify.listen({
port: PORT,
host: '0.0.0.0'
})

console.log("Serveur lancé")

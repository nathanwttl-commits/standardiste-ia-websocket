import Fastify from "fastify"
import formbody from "@fastify/formbody"

const fastify = Fastify({ logger: true })

await fastify.register(formbody)

const sessions = {}

// ==========================
// ROUTE /voice
// ==========================

fastify.post("/voice", async (request, reply) => {

const callSid = request.body.CallSid

sessions[callSid] = {
step: "initial",
attempt: 0
}

const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>

<Gather
input="speech"
action="https://standardiste-v1-ia-production.up.railway.app/conversation"
method="POST"
timeout="6"
speechTimeout="auto"
language="fr-FR">

<Say voice="Polly.Celine" language="fr-FR">
Bonjour et bienvenue à la Carrosserie du Lac.
Je suis l’assistant vocal de réception.
Afin d’améliorer notre service, cet appel peut être enregistré.
Comment puis-je vous aider aujourd’hui ?
Par exemple pour un suivi de réparation ou une demande de rendez-vous.
</Say>

</Gather>

<Say voice="Polly.Celine" language="fr-FR">
Je n'ai pas entendu votre réponse.
</Say>

<Redirect method="POST">
https://standardiste-v1-ia-production.up.railway.app/voice
</Redirect>

</Response>`

reply.type("text/xml").send(twiml)

})

// ==========================
// ROUTE /conversation
// ==========================

fastify.post("/conversation", async (request, reply) => {

const speech = request.body.SpeechResult || ""
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
// Appel Make
// ==========================

let makeResponse

try {

makeResponse = await fetch("https://hook.eu1.make.com/eombd2fwis2ker13qun48oq2g8yymdvy", {

method: "POST",

headers: {
"Content-Type": "application/json"
},

body: JSON.stringify({
speech: speech,
phone: phone,
step: session.step,
attempt: session.attempt
})

})

} catch (error) {

console.error("Erreur Make", error)

return reply.type("text/xml").send(`
<Response>
<Say voice="Polly.Celine" language="fr-FR">
Je rencontre un problème technique.
Je vous transfère à la réception.
</Say>
<Dial>+33769170012</Dial>
</Response>
`)
}

let decision

try {

decision = await makeResponse.json()

} catch {

console.error("JSON Make invalide")

return reply.type("text/xml").send(`
<Response>
<Say voice="Polly.Celine" language="fr-FR">
Je vous transfère à la réception.
</Say>
<Dial>+33769170012</Dial>
</Response>
`)
}

// ==========================
// Mise à jour step session
// ==========================

session.step = decision.step || session.step

// ==========================
// TRANSFERT
// ==========================

if (decision.transfer) {

return reply.type("text/xml").send(`
<Response>

<Say voice="Polly.Celine" language="fr-FR">
${decision.say}
</Say>

<Dial>${decision.transfer_to}</Dial>

</Response>
`)

}

// ==========================
// FIN APPEL
// ==========================

if (decision.end_call) {

return reply.type("text/xml").send(`
<Response>

<Say voice="Polly.Celine" language="fr-FR">
${decision.say}
</Say>

</Response>
`)

}

// ==========================
// ECOUTE CLIENT
// ==========================

if (decision.listen) {

return reply.type("text/xml").send(`
<Response>

<Gather
input="speech"
action="https://standardiste-v1-ia-production.up.railway.app/conversation"
method="POST"
timeout="6"
speechTimeout="auto"
language="fr-FR">

<Say voice="Polly.Celine" language="fr-FR">
${decision.say}
</Say>

</Gather>

<Say voice="Polly.Celine" language="fr-FR">
Je n'ai pas entendu votre réponse.
</Say>

<Redirect method="POST">
https://standardiste-v1-ia-production.up.railway.app/conversation
</Redirect>

</Response>
`)

}

// ==========================
// REPONSE SIMPLE
// ==========================

return reply.type("text/xml").send(`
<Response>

<Say voice="Polly.Celine" language="fr-FR">
${decision.say}
</Say>

</Response>
`)

})

// ==========================
// LANCEMENT SERVEUR
// ==========================

const PORT = process.env.PORT || 3000

await fastify.listen({
port: PORT,
host: "0.0.0.0"
})

console.log("Serveur lancé")

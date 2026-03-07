import Fastify from 'fastify'
import formbody from '@fastify/formbody'

const fastify = Fastify({ logger: true })
await fastify.register(formbody)

const sessions = {}

// ---------- détecteurs ----------

function normalizePlate(text){

if(!text) return null

let t = text.toUpperCase()
.replace(/ /g,'')
.replace(/-/g,'')
.replace(/\./g,'')
.replace(/,/g,'')

const numbers={
"ZERO":"0","UN":"1","DEUX":"2","TROIS":"3",
"QUATRE":"4","CINQ":"5","SIX":"6","SEPT":"7",
"HUIT":"8","NEUF":"9"
}

Object.keys(numbers).forEach(w=>{
t=t.replace(new RegExp(w,"g"),numbers[w])
})

const match=t.match(/[A-Z]{2}[0-9]{3}[A-Z]{2}/)

return match?match[0]:null
}

function detectOR(text){

if(!text) return null

const t=text.toUpperCase().replace(/ /g,'')

const match=t.match(/OR[0-9]{4,}/)

return match?match[0]:null
}

function detectSinistre(text){

if(!text) return null

const t=text.toUpperCase().replace(/ /g,'')

const match=t.match(/[0-9]{6,}/)

return match?match[0]:null
}

// ---------- ROUTE VOICE ----------

fastify.post('/voice', async (request, reply)=>{

const twiml=`<?xml version="1.0" encoding="UTF-8"?>
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

// ---------- ROUTE CONVERSATION ----------

fastify.post('/conversation', async (request, reply)=>{

const userSpeech=request.body.SpeechResult||""
const confidence=parseFloat(request.body.Confidence||0)
const phone=request.body.From||""
const callSid=request.body.CallSid

if(!sessions[callSid]){

sessions[callSid]={
step:"initial",
attempt:0,
identifier:null,
identifier_type:null
}

}

const session=sessions[callSid]

if(!userSpeech||confidence<0.6){

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

// ---------- detection identifiants ----------

const plate=normalizePlate(userSpeech)
const or=detectOR(userSpeech)
const sinistre=detectSinistre(userSpeech)

if(plate){

session.identifier=plate
session.identifier_type="immatriculation"
session.step="confirm"

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
Vous avez dit ${plate}. Est-ce correct ?
</Say>

</Gather>

</Response>`)

}

if(or){

session.identifier=or
session.identifier_type="ordre_reparation"
session.step="confirm"

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
Vous avez donné l'ordre de réparation ${or}. Est-ce correct ?
</Say>

</Gather>

</Response>`)

}

if(sinistre){

session.identifier=sinistre
session.identifier_type="sinistre"
session.step="confirm"

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
Vous avez donné le numéro de sinistre ${sinistre}. Est-ce correct ?
</Say>

</Gather>

</Response>`)

}

// ---------- confirmation ----------

if(session.step==="confirm"){

const answer=userSpeech.toLowerCase()

if(answer.includes("oui")){

const makeResponse=await fetch("https://hook.eu1.make.com/eombd2fwis2ker13qun48oq2g8yymdvy",{
method:"POST",
headers:{'Content-Type':'application/json'},
body:JSON.stringify({
phone:phone,
identifier:session.identifier,
type:session.identifier_type
})
})

const makeData=await makeResponse.json()

return reply.type('text/xml').send(`
<Response>

<Say voice="Polly.Celine" language="fr-FR">
${makeData.reply}
</Say>

</Response>`)

}

if(answer.includes("non")){

session.step="initial"

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
Très bien. Pouvez-vous me redonner votre immatriculation, numéro de sinistre ou ordre de réparation ?
</Say>

</Gather>

</Response>`)

}

}

// ---------- fallback Make ----------

try{

const makeResponse=await fetch("https://hook.eu1.make.com/eombd2fwis2ker13qun48oq2g8yymdvy",{
method:"POST",
headers:{'Content-Type':'application/json'},
body:JSON.stringify({
speech:userSpeech,
phone:phone
})
})

const makeData=await makeResponse.json()

return reply.type('text/xml').send(`
<Response>

<Say voice="Polly.Celine" language="fr-FR">
${makeData.reply}
</Say>

</Response>`)

}catch(e){

return reply.type('text/xml').send(`
<Response>

<Say voice="Polly.Celine" language="fr-FR">
Je vous transfère à la réception.
</Say>

<Dial>+33769170012</Dial>

</Response>`)

}

})

// ---------- serveur ----------

const PORT=process.env.PORT||3000

await fastify.listen({
port:PORT,
host:'0.0.0.0'
})

console.log("Serveur lancé")

fastify.post('/voice', async (request, reply) => {
  const twiml = `
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="fr-FR">
    Bonjour. Le standard IA est maintenant actif.
  </Say>
</Response>
`.trim()

  reply
    .code(200)
    .header('Content-Type', 'text/xml; charset=utf-8')
    .send(twiml)
})

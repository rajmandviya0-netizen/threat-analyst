const fetch = require('node-fetch');

async function triageAlert(alert) {
  const prompt = `You are a cybersecurity analyst. Analyze this security alert and respond ONLY with a JSON object, no other text.

Alert:
- Type: ${alert.rule_name}
- Source IP: ${alert.source_ip}
- Severity: ${alert.severity}
- Details: ${alert.description}

Respond with exactly this JSON format:
{
  "explanation": "2-3 sentence plain English explanation of what this alert means and why it is dangerous",
  "mitreId": "T1234",
  "mitreTechnique": "Technique Name"
}`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    })
  });

  const data = await response.json();
  console.log('Groq response:', JSON.stringify(data, null, 2));

  if (!data.choices || data.choices.length === 0) {
    throw new Error('No choices in Groq response: ' + JSON.stringify(data));
  }

  const text = data.choices[0].message.content;
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

async function triageSearch(userQuery) {
  const prompt = `You are a PostgreSQL expert. Convert this natural language query into a safe SQL SELECT query for the alerts table.

Table schema:
- id (integer)
- rule_name (varchar)
- severity (varchar) — values: low, medium, high, critical
- description (text)
- source_ip (varchar)
- created_at (timestamp)
- explanation (text)
- mitre_id (varchar)
- mitre_technique (varchar)

User query: "${userQuery}"

Respond ONLY with a JSON object:
{
  "sql": "SELECT * FROM alerts WHERE ... ORDER BY created_at DESC LIMIT 20"
}

Rules:
- Only SELECT statements, never INSERT/UPDATE/DELETE
- Always include ORDER BY created_at DESC
- Always include LIMIT 20`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1
    })
  });

  const data = await response.json();
  const text = data.choices[0].message.content;
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

module.exports = { triageAlert, triageSearch };
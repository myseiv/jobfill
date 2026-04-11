const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

export async function generateAnswer({ apiKey, model, fieldLabel, jdText, profileChunk }) {
  const response = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are helping fill in a job application. Answer concisely in 2-4 sentences. Write in first person. Do not use bullet points. Answer only the specific question asked.',
        },
        {
          role: 'user',
          content: `Job description:\n${jdText}\n\nApplicant profile:\n${profileChunk}\n\nQuestion/field: "${fieldLabel}"\n\nWrite a short answer for this field.`,
        },
      ],
      max_tokens: 300,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

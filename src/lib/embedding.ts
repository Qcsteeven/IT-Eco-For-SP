export async function getEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://api.fireworks.ai/inference/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.FIREWORKS_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'nomic-ai/nomic-embed-text-v1.5', // ← embedding-модель
      input: text,
      encoding_format: 'float',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Fireworks Embedding API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.data[0].embedding; // массив чисел
}
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function getEmbedding(text: string): Promise<number[]> {
  console.log('🔍 Getting embedding for:', text)
  console.log('🔑 Key exists:', !!process.env.OPENAI_API_KEY)
  
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text
  })

  if (!response?.data?.[0]?.embedding) {
    throw new Error('Invalid embedding response from OpenAI')
  }

  console.log('✅ Embedding success, dimensions:', response.data[0].embedding.length)
  return response.data[0].embedding
}

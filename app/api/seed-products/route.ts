import { NextResponse } from 'next/server'
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime"
import { Pinecone } from '@pinecone-database/pinecone'
import { createClient } from '@supabase/supabase-js'

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "us-east-1",
  // If using bearer token, provide dummy credentials to avoid loading error
  credentials: process.env.AWS_BEARER_TOKEN_BEDROCK
    ? { accessKeyId: 'dummy', secretAccessKey: 'dummy' }
    : undefined
})

// ── Bearer Token Middleware ──────────────────────────────────────────────────
if (process.env.AWS_BEARER_TOKEN_BEDROCK) {
  bedrock.middlewareStack.add(
    (next) => (args: any) => {
      args.request.headers["Authorization"] = `Bearer ${process.env.AWS_BEARER_TOKEN_BEDROCK}`;
      return next(args);
    },
    {
      step: "build",
      name: "addBearerToken",
    }
  );
}

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! })
const EMBED_MODEL = "amazon.titan-embed-text-v2:0"
const EMBED_DIMS = 1024

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST() {
  try {
    // Fetch products from Supabase
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, base_price_paisa, emoji')

    if (error || !products?.length) {
      return NextResponse.json({ success: false, error: 'No products found' })
    }

    const index = pinecone.index(process.env.PINECONE_INDEX_NAME ?? 'products')

    // Create embeddings for all products via Bedrock
    const vectors = await Promise.all(
      products.map(async (p) => {
        const text = `${p.name} ${p.emoji} food item priced at ${p.base_price_paisa / 100} rupees`

        const body = JSON.stringify({
          inputText: text,
          dimensions: EMBED_DIMS,
          normalize: true
        });

        const command = new InvokeModelCommand({
          modelId: EMBED_MODEL,
          contentType: "application/json",
          accept: "application/json",
          body: body
        });

        const response = await bedrock.send(command);
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));

        return {
          id: p.id,
          values: responseBody.embedding,
          metadata: {
            name: p.name,
            base_price_paisa: p.base_price_paisa,
            emoji: p.emoji,
          }
        }
      })
    )

    // Upsert to Pinecone
    await index.upsert({
      records: vectors.map(v => ({
        id: v.id,
        values: v.values,
        metadata: v.metadata
      }))
    } as Parameters<typeof index.upsert>[0])

    return NextResponse.json({
      success: true,
      message: `✅ Seeded ${vectors.length} products into Pinecone`
    })

  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json({ success: false, error: String(error) })
  }
}
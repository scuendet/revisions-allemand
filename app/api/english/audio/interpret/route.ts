import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(req: NextRequest) {
  const { transcribed, expected_english } = await req.json()

  if (!transcribed || !expected_english) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 16,
      messages: [
        {
          role: 'user',
          content: `A student learning English was asked to say: "${expected_english}". Speech recognition heard: "${transcribed}". Is this a correct or close-enough match, accounting for minor pronunciation or transcription differences (e.g. capitalisation, missing punctuation, singular/plural variations)? Reply with only true or false.`,
        },
      ],
    })

    const text = (response.content[0].type === 'text' ? response.content[0].text : '').toLowerCase().trim()
    const correct = text.startsWith('true')
    return NextResponse.json({ transcribed, correct })
  } catch (e: any) {
    const msg = e?.message ?? String(e)
    console.error('English audio interpret error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

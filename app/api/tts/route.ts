import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY;
    const VOICE_ID = process.env.ELEVENLABS_VOICE_ID;

    if (!ELEVEN_API_KEY || !VOICE_ID) {
      console.error("ElevenLabs keys no configuradas");
      return NextResponse.json({ error: "ElevenLabs no configurado" }, { status: 500 });
    }

    const elevenRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": ELEVEN_API_KEY,
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.8,
            style: 0.0,
            use_speaker_boost: true
          }
        }),
      }
    );

    if (!elevenRes.ok) {
      const textErr = await elevenRes.text();
      console.error("ElevenLabs error:", textErr);
      return NextResponse.json({ error: "Error al generar audio" }, { status: 500 });
    }

    const buffer = await elevenRes.arrayBuffer();
    return new Response(Buffer.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Error TTS route:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

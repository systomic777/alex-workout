export interface Env {
  ELEVENLABS_API_KEY: string;
  ELEVENLABS_VOICE_ID?: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const apiKey = env.ELEVENLABS_API_KEY;
    const defaultVoiceId = env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing ELEVENLABS_API_KEY' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      });
    }

    const body = await request.json().catch(() => ({} as any));
    const text = (body?.text ?? '').toString();
    const voiceId = (body?.voiceId ?? defaultVoiceId).toString();

    if (!text || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Missing text' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }

    const safeText = text.length > 600 ? text.slice(0, 597) + '...' : text;
    const model_id = 'eleven_turbo_v2_5';

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        accept: 'audio/mpeg',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        text: safeText,
        model_id,
        voice_settings: {
          stability: 0.65,
          similarity_boost: 0.85,
          style: 0.35,
          use_speaker_boost: true,
        },
      }),
    });

    const ct = resp.headers.get('content-type') || '';

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      return new Response(JSON.stringify({ error: 'ElevenLabs error', status: resp.status, contentType: ct, details: errText.slice(0, 600) }), {
        status: resp.status,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (!ct.toLowerCase().includes('audio')) {
      const errText = await resp.text().catch(() => '');
      return new Response(JSON.stringify({ error: 'Unexpected ElevenLabs response', contentType: ct, details: errText.slice(0, 600) }), {
        status: 502,
        headers: { 'content-type': 'application/json' },
      });
    }

    const audio = await resp.arrayBuffer();
    return new Response(audio, {
      status: 200,
      headers: {
        'content-type': 'audio/mpeg',
        'cache-control': 'no-store',
      },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: 'Server error', details: e?.message || String(e) }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
};

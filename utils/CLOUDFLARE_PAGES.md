# Deploy to Cloudflare Pages (with Functions)

This repo is a Vite + React app with a Cloudflare Pages Function:
- `functions/api/tts.ts` → POST `/api/tts` (server-side ElevenLabs proxy)

## 1) Create GitHub repo
- Create a new repo on GitHub (e.g. `alex-workout`)
- Push this code

## 2) Create a Cloudflare account
https://dash.cloudflare.com/sign-up

## 3) Create a Pages project
Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → Connect to GitHub → pick the repo.

### Build settings
- Framework preset: **Vite** (or None)
- Build command: `npm run build`
- Build output directory: `dist`

## 4) Add environment variables (Secrets)
Pages project → **Settings** → **Environment variables**
Add for **Production** (and Preview if you want):
- `ELEVENLABS_API_KEY` (secret)
- optional `ELEVENLABS_VOICE_ID`

## 5) Deploy
Cloudflare will build + deploy and give you a URL.

## Notes
- The app calls `/api/tts` — this is handled by Pages Functions.
- No Netlify required.

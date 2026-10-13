# Deploy to Cloudflare Workers

1. `npm install`
2. `npx wrangler login`
3. `npx wrangler d1 create haxworks`  -> copy the `database_id` it prints into `wrangler.jsonc`
4. `npm run cf:d1:migrate`            -> creates the review_notes table
5. `npx wrangler secret put GEMINI_API_KEY`  -> paste your Gemini key (do not put it in files)
6. `npm run deploy`                   -> builds and runs `wrangler deploy`

Local test: `npm run cf:preview` (put the key in a `.dev.vars` file: GEMINI_API_KEY=...).
Custom domain: Cloudflare dashboard -> Workers -> haxworks -> Settings -> Domains & Routes.

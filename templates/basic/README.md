# fewbie basic template

The starter template scaffolded by [`fewbie init`](https://github.com/worldzhy/fewbie):
Next.js (App Router, TypeScript, Turbopack) + Tailwind CSS v4 + shadcn/ui.

## Scripts

```bash
npm run dev     # start the dev server (Turbopack)
npm run build   # production build
npm run start   # serve the production build
npm run lint    # eslint
```

## UI components

The template ships a small set of shadcn/ui primitives under
`src/components/ui/` (button, card, input, dialog, ...). Add more with the
official CLI:

```bash
npx shadcn@latest add <component>
```

Standard ui primitives come straight from shadcn/ui; fewbie-specific business
components and logic utils are installed with `fewbie add <name>` from the
fewbie registry.

## Heartbeat (optional)

`src/instrumentation.ts` reports liveness to the heartbeat server when
both env vars are set (see `.env.example`):

- `HEARTBEAT_ENDPOINT` — full heartbeat report URL (e.g. `https://host/heartbeat/ping`)
- `HEARTBEAT_TOKEN` — installation token (sent as `X-Heartbeat-Token`)

Without them the hook is a no-op.

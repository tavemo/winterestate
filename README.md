# Christmas Vault (One-Time Christmas Gift Site)

This is a small, hosted **Christmas vault** experience for **Christine & Chuck Sandford**:
- land on page → excitement
- **Lock 1** → solve → reward
- **Lock 2** → solve → reward
- **Lock 3** → solve → reward
- **reveal** the code + a vague clue about where it goes

It culminates in revealing a **Product Code** (not called a “key”), with an optional (collapsed) hint about redeeming it in Steam.

## Files
- `index.html`: Vite entry
- `src/App.tsx`: UI + puzzle flow
- `src/styles.css`: theme + puzzle UI
- `vite.config.ts`: dev server config (port 3005)

## Run locally
Install dependencies once:

```bash
npm install
```

Run the dev server (port **3005**):

```bash
npm run dev -- --host
```

Then open:
- `http://localhost:3005`
- or the Network URL printed in the terminal (so other devices on Wi‑Fi can open it)

## Deploy (hosted static site)
Any static host works:
- **Netlify**: set build command `npm run build` and publish directory `dist`.
- **Vercel**: framework preset “Vite”; output directory `dist` (includes `vercel.json` SPA rewrite).
- **GitHub Pages**: build and publish the `dist` folder.

Build locally:

```bash
npm run build
```

## Customize (quick edits)
### Names / copy
- Update copy in `src/App.tsx` (Intro + Reveal sections).

### Puzzle difficulty
All puzzle logic lives in `src/App.tsx`:
- **Blueprint tile**: `const correct = { r: 2, c: 3 }`
- **Library order**: `const correct = ["valve","store","library","install","account"]`

### Resetting progress
Progress is saved to `localStorage` under:
- `winter_estate_react_v1`

Use the **Reset** button in the UI to clear it.

## The revealed code
The fragments are defined in `src/App.tsx` as:
- `Y9J8X`
- `5G546`
- `Q4FRK`

And assemble to:
- `Y9J8X-5G546-Q4FRK`



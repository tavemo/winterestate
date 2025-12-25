## Go‑Live “Massive Uplift” Plan (Blue Book Christmas Card)

### Goals
- **Zero “boot to start” surprises**: stage persistence is reliable on iOS tab restores / reload quirks.
- **One-song rule**: exactly one background track at a time; deterministic transitions.
- **High clarity**: older users can always see the next action; no confusing widgets.
- **Premium feel**: more tiny interactions (sound + micro-motion) everywhere, without clutter.

---

### 1) QA sweep checklist (do this as a true end-to-end run)
- **iPhone SE portrait**
  - Envelope tap reliability (seal break, no double-tap zoom)
  - Page tapping: page advance vs “reveal this page” behavior feels predictable
  - “Open your gift” always visible, never overlaps safe-area
- **iPhone 14 portrait**
  - Present taps feel responsive under load; no stuck overlays
  - Hack overlay: persists until tap; tap works reliably
- **iPad portrait**
  - Letter readability: line-height + margins + “page” cadence comfortable
  - Terminal: MCQ grids fit without scroll; input doesn’t zoom
- **Audio**
  - First gesture starts audio (if sound enabled)
  - Transition: letter bed → loot box bed (present) **always** happens
  - No “two songs at once” during wins/overlays
  - Wrong-answer rage burst + lingering red wash behaves consistently
- **Persistence**
  - Leave tab, come back (iOS), you’re still on the same screen
  - Hard restart button always returns to note (and stops any special tracks/overlays)

---

### 2) Hardening pass (bugs + guardrails)
- **Stage persistence invariants**
  - Never force-reset stage on navigation timing signals (iOS is unreliable)
  - Add a small “sanity repair” on load: if state.stage is unknown, default to `note`
- **Music invariants**
  - Centralize mapping from **(stage, hijacked, roomIdx)** → track
  - After any overlay-only audio (victory/end), resume the right track for the current stage
  - Ensure “sound toggle on” resumes the correct current-stage bed
- **Overlay invariants**
  - Overlays that require “tap to continue” must disable input underneath
  - Add a single global `Esc` close where appropriate (desktop)

---

### 3) Premium polish pass (big impact, low risk)
- **Micro SFX everywhere**
  - Button tap tick on every primary/secondary button (letter, present HUD, terminal submit)
  - Page turn has a distinct “paper” moment (already present)
  - Add subtle hover/press states for desktop without affecting mobile
- **Terminal title cards**
  - 1-time “Dark Souls” red title card after boot (implemented)
  - Optional: 1-line “chapter” card when entering Room 05 / Room 10 (super short, 700ms)
- **Better “room travel”**
  - Stronger background wash per room (already partially there)
  - Add room-specific tiny ornament icon (non-clickable) so it feels like a tour

---

### 4) Branding / narrative clarity (without giving the game away)
You want “estate / blueprint / key” vibes but *not* “Blue Prince” explicitly.

- **Recommended direction**: keep the site name neutral and story-forward:
  - `wintercycle.ca`
  - `estate-key.ca`
  - `bluebookgift.ca`
  - `thebluebook.ca` (if available)
- **Avoid**: `blueprince.ca` (it’s searchable and could spoil the reveal if they get curious)

---

### 5) Final pre-launch checklist
- Confirm all required files exist under `public/easter/`
- Run `npm run build`
- Test a full run with sound ON and OFF
- Test “Restart” from every stage (present/terminal/reward/final)



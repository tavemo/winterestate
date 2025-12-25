/* Winter Estate Tour
   - Single-page puzzle flow
   - localStorage persistence
   - subtle sound via WebAudio (default off)
*/

const STORAGE_KEY = "winter_estate_v1";

const KEY_FRAGMENTS = {
  frag1: "Y9J8X",
  frag2: "5G546",
  frag3: "Q4FRK",
};

const ROOMS = ["foyer", "blueprint", "library", "workshop", "hearth"];

const DEFAULT_STATE = {
  currentRoom: "foyer",
  solved: {
    foyer: false,
    blueprint: false,
    library: false,
    workshop: false,
    hearth: false,
  },
  fragmentsUnlocked: {
    frag1: false,
    frag2: false,
    frag3: false,
  },
  hintLevelByRoom: {
    foyer: 0,
    blueprint: 0,
    library: 0,
    workshop: 0,
    hearth: 0,
  },
  settings: {
    sound: false,
    reduceMotion: false,
    highContrast: false,
  },
  // per-room puzzle state
  puzzle: {
    blueprint: { solved: false },
    library: { clicks: [] },
    workshop: { slots: ["", "", ""] },
  },
};

const HINTS = {
  foyer: [
    "There’s only one button in the Foyer. It’s polite to press it.",
    "Start the tour. The map will open a door.",
    "Click “Begin the tour.”",
  ],
  blueprint: [
    "One tile is warmer than the rest. You may not see it at first.",
    "Look for the tiniest holiday detail. It’s subtle by design.",
    "The correct tile is the one with the ornament mark. Click it.",
  ],
  library: [
    "The right books describe a very modern kind of “library.”",
    "Try clicking words that sound like: store → library → install → account.",
    "Click: Valve, Store, Library, Install, Account (in that order).",
  ],
  workshop: [
    "Three fragments want to become one ticket-shaped code.",
    "Match the familiar shape: five-five-five, with dashes between.",
    "Put them in order: Y9J8X then 5G546 then Q4FRK.",
  ],
  hearth: [
    "This code belongs in a digital library app.",
    "It’s redeemed inside an app called Steam, in a menu named Games.",
    "Open Steam → Games → Activate a Product… then paste the code.",
  ],
};

function safeParse(json, fallback) {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(DEFAULT_STATE);
  const parsed = safeParse(raw, null);
  if (!parsed || typeof parsed !== "object") return structuredClone(DEFAULT_STATE);
  return deepMerge(structuredClone(DEFAULT_STATE), parsed);
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function deepMerge(base, patch) {
  if (patch == null || typeof patch !== "object") return base;
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      base[k] = deepMerge(base[k] ?? {}, v);
    } else {
      base[k] = v;
    }
  }
  return base;
}

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

let state = loadState();
let audio = null;
let inactivityTimer = null;

function setStatus(text) {
  const el = $("#footerStatus");
  if (el) el.textContent = text;
}

function unlockedRooms() {
  const unlocked = new Set(["foyer"]);
  if (state.solved.foyer) unlocked.add("blueprint");
  if (state.solved.blueprint) unlocked.add("library");
  if (state.solved.library) unlocked.add("workshop");
  if (state.solved.workshop) unlocked.add("hearth");
  return unlocked;
}

function applySettings() {
  document.body.classList.toggle("reduce-motion", !!state.settings.reduceMotion);
  document.body.classList.toggle("high-contrast", !!state.settings.highContrast);

  const soundToggle = $("#toggleSound");
  const reduceToggle = $("#toggleReduceMotion");
  const contrastToggle = $("#toggleHighContrast");
  if (soundToggle) soundToggle.checked = !!state.settings.sound;
  if (reduceToggle) reduceToggle.checked = !!state.settings.reduceMotion;
  if (contrastToggle) contrastToggle.checked = !!state.settings.highContrast;
}

function ensureAudio() {
  if (!state.settings.sound) return null;
  if (audio) return audio;
  audio = new (window.AudioContext || window.webkitAudioContext)();
  return audio;
}

function playTone(type = "ok") {
  if (!state.settings.sound) return;
  const ctx = ensureAudio();
  if (!ctx) return;

  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.06, now + 0.01);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
  master.connect(ctx.destination);

  const make = (freq, t0, t1, wave = "sine") => {
    const o = ctx.createOscillator();
    o.type = wave;
    o.frequency.setValueAtTime(freq, t0);
    o.connect(master);
    o.start(t0);
    o.stop(t1);
  };

  if (type === "ok") {
    make(440, now, now + 0.18, "triangle");
    make(660, now + 0.02, now + 0.2, "triangle");
  } else if (type === "unlock") {
    make(523.25, now, now + 0.16, "triangle");
    make(659.25, now + 0.02, now + 0.2, "triangle");
    make(783.99, now + 0.04, now + 0.24, "triangle");
  } else {
    make(120, now, now + 0.18, "sine");
  }
}

function setRoom(room) {
  const unlocked = unlockedRooms();
  if (!unlocked.has(room)) {
    setStatus("That door is still locked.");
    playTone("bad");
    return;
  }
  state.currentRoom = room;
  saveState();
  render();
}

function unlockFragment(which) {
  if (state.fragmentsUnlocked[which]) return;
  state.fragmentsUnlocked[which] = true;
  saveState();
  renderFragments();
  playTone("unlock");
}

function markSolved(room) {
  if (state.solved[room]) return;
  state.solved[room] = true;
  saveState();
  renderMap();
}

function sanitizeStateForUnlocks() {
  // Ensure the flow cannot skip ahead if localStorage was edited or partially saved.
  const canAccess = unlockedRooms();
  if (!canAccess.has(state.currentRoom)) state.currentRoom = "foyer";

  // Fragment III should never be unlocked before the Workshop solution.
  if (!state.solved.workshop) state.fragmentsUnlocked.frag3 = false;

  // If blueprint/library are unsolved, reset their derived puzzle state.
  if (!state.solved.blueprint) state.puzzle.blueprint.solved = false;
  if (!state.solved.library) state.puzzle.library.clicks = state.puzzle.library.clicks ?? [];
  if (!state.solved.workshop) state.puzzle.workshop.slots = state.puzzle.workshop.slots ?? ["", "", ""];
}

function resetAll() {
  state = structuredClone(DEFAULT_STATE);
  saveState();
  render();
  setStatus("Reset complete.");
}

function renderMap() {
  const unlocked = unlockedRooms();
  for (const btn of $$(".map__room")) {
    const room = btn.getAttribute("data-room");
    const locked = !unlocked.has(room);
    btn.dataset.locked = String(locked);
    btn.disabled = locked;
    btn.setAttribute("aria-current", room === state.currentRoom ? "true" : "false");
  }

  const unlockedCount = unlocked.size;
  const meta = $("#progressMeta");
  if (meta) meta.textContent = `${unlockedCount}/5 unlocked`;
}

function renderFragments() {
  const map = [
    ["frag1", $("#frag1")],
    ["frag2", $("#frag2")],
    ["frag3", $("#frag3")],
  ];
  for (const [k, el] of map) {
    if (!el) continue;
    const unlocked = !!state.fragmentsUnlocked[k];
    el.classList.toggle("fragment--locked", !unlocked);
    el.classList.toggle("fragment--unlocked", unlocked);
    el.setAttribute("aria-label", unlocked ? `Fragment ${k} unlocked` : `Fragment ${k} locked`);
    const value = el.querySelector(".fragment__value");
    if (value) value.textContent = unlocked ? KEY_FRAGMENTS[k] : "LOCKED";
  }
}

function getAssembledCode() {
  return `${KEY_FRAGMENTS.frag1}-${KEY_FRAGMENTS.frag2}-${KEY_FRAGMENTS.frag3}`;
}

function currentHints() {
  const room = state.currentRoom;
  const level = state.hintLevelByRoom[room] ?? 0;
  const hints = HINTS[room] ?? ["No hints for this room."];
  const idx = Math.max(0, Math.min(level, hints.length - 1));
  return { room, level: idx, hint: hints[idx], total: hints.length };
}

function hintNext() {
  const room = state.currentRoom;
  const total = (HINTS[room] ?? []).length;
  const next = Math.min((state.hintLevelByRoom[room] ?? 0) + 1, Math.max(0, total - 1));
  state.hintLevelByRoom[room] = next;
  saveState();
  renderHelp();
}

function hintReset() {
  const room = state.currentRoom;
  state.hintLevelByRoom[room] = 0;
  saveState();
  renderHelp();
}

function renderHelp() {
  const { room, level, hint, total } = currentHints();
  const meta = $("#hintMeta");
  const text = $("#hintText");
  if (meta) meta.textContent = `Room: ${room.toUpperCase()} · Hint ${level + 1} of ${total}`;
  if (text) text.textContent = hint;
}

function openHelp() {
  renderHelp();
  $("#helpModal")?.showModal?.();
}

function openSettings() {
  applySettings();
  $("#settingsModal")?.showModal?.();
}

function armInactivityHint(room) {
  if (inactivityTimer) window.clearTimeout(inactivityTimer);
  // nudge only for puzzle rooms
  const nudgeRooms = new Set(["blueprint", "library", "workshop"]);
  if (!nudgeRooms.has(room)) return;

  inactivityTimer = window.setTimeout(() => {
    setStatus("If you’d like: press “Need a hint?” for a gentle nudge.");
  }, 55_000);
}

function renderRoom() {
  const stage = $("#stage");
  if (!stage) return;
  stage.innerHTML = "";

  const room = state.currentRoom;
  armInactivityHint(room);

  if (room === "foyer") {
    stage.appendChild(roomFoyer());
  } else if (room === "blueprint") {
    stage.appendChild(roomBlueprint());
  } else if (room === "library") {
    stage.appendChild(roomLibrary());
  } else if (room === "workshop") {
    stage.appendChild(roomWorkshop());
  } else if (room === "hearth") {
    stage.appendChild(roomHearth());
  }
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (v === false || v == null) continue;
    else node.setAttribute(k, String(v));
  }
  for (const ch of children) node.appendChild(ch);
  return node;
}

function roomShell({ kicker, title, textNodes, actions = [] }) {
  const wrap = el("div", { class: "room" });
  wrap.appendChild(el("div", { class: "room__kicker", text: kicker }));
  wrap.appendChild(el("div", { class: "room__title", text: title }));
  for (const t of textNodes) wrap.appendChild(t);
  wrap.appendChild(el("div", { class: "divider" }));
  const row = el("div", { class: "room__ctaRow" });
  for (const a of actions) row.appendChild(a);
  wrap.appendChild(row);
  return wrap;
}

function roomFoyer() {
  const intro1 = el("div", {
    class: "room__text",
    text:
      "Welcome, Christine and Chuck. This little site is a one-time winter tour — five rooms, a few locks, and a quiet surprise waiting by the fire.",
  });
  const intro2 = el("div", {
    class: "room__text",
    text:
      "Nothing is timed. Nothing is tricky on purpose. If you ever want help, the hint button will start gentle and get clearer.",
  });

  const begin = el("button", {
    class: "btn",
    type: "button",
    text: state.solved.foyer ? "Continue the tour" : "Begin the tour",
    onclick: () => {
      markSolved("foyer");
      setStatus("A door clicks open on the map.");
      playTone("unlock");
      setRoom("blueprint");
    },
  });

  const peek = el("button", {
    class: "btn btn--ghost",
    type: "button",
    text: "Look at the map",
    onclick: () => setStatus("Choose an unlocked room from the left."),
  });

  return roomShell({
    kicker: "Room_01",
    title: "The Foyer",
    textNodes: [intro1, intro2],
    actions: [begin, peek],
  });
}

function roomBlueprint() {
  const t1 = el("div", {
    class: "room__text",
    text:
      "A blueprint rests on the desk. Most tiles are cold ink… but one is a little warmer, like it remembers candlelight.",
  });

  const grid = el("div", { class: "bpGrid", role: "group", "aria-label": "Blueprint grid" });
  const correct = { r: 2, c: 3 }; // subtle, stable

  const solved = !!state.solved.blueprint;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const isCorrect = r === correct.r && c === correct.c;
      const ornament = isCorrect ? "✶" : "";
      const btn = el("button", {
        class: "bpTile",
        type: "button",
        "data-r": r,
        "data-c": c,
        "aria-label": isCorrect ? "Tile with a tiny ornament mark" : "Blueprint tile",
        disabled: solved,
        onclick: () => {
          if (state.solved.blueprint) return;
          if (isCorrect) {
            state.puzzle.blueprint.solved = true;
            unlockFragment("frag1");
            markSolved("blueprint");
            setStatus("The paper yields a first fragment.");
            playTone("unlock");
            setRoom("library");
          } else {
            setStatus("Cold ink. Try another tile.");
            playTone("bad");
            btn.classList.add("bpTile--wrong");
            window.setTimeout(() => btn.classList.remove("bpTile--wrong"), 280);
          }
        },
      });

      btn.innerHTML = ornament ? `<span class="bpOrnament" aria-hidden="true">${ornament}</span>` : "";
      grid.appendChild(btn);
    }
  }

  const note = el("div", { class: "room__text" });
  note.innerHTML =
    'Reward: <span class="kbd">Fragment I</span> will appear in the “Collected” panel.';

  return roomShell({
    kicker: "Room_02",
    title: "The Blueprint",
    textNodes: [t1, grid, note],
    actions: [
      el("button", { class: "btn btn--ghost", type: "button", text: "Need a hint?", onclick: openHelp }),
    ],
  });
}

function roomLibrary() {
  const t1 = el("div", {
    class: "room__text",
    text:
      "In the Library, a row of spines looks more like instructions than novels. Some words feel like they belong together.",
  });

  const books = [
    { id: "snow", label: "Snowfall Almanac" },
    { id: "valve", label: "Valve" },
    { id: "store", label: "Store" },
    { id: "library", label: "Library" },
    { id: "install", label: "Install" },
    { id: "account", label: "Account" },
    { id: "coal", label: "Coal & Kindling" },
  ];

  const correct = ["valve", "store", "library", "install", "account"];
  const shelf = el("div", { class: "shelf", role: "group", "aria-label": "Bookshelf" });

  const progress = el("div", { class: "bookmark", id: "libraryProgress" });
  progress.textContent = "Sequence: —";

  function updateProgress() {
    const labels = state.puzzle.library.clicks.map((id) => books.find((b) => b.id === id)?.label ?? id);
    progress.textContent = labels.length ? `Sequence: ${labels.join(" → ")}` : "Sequence: —";
  }

  function pushClick(id) {
    if (state.solved.library) return;
    const nextIdx = state.puzzle.library.clicks.length;
    const expected = correct[nextIdx];
    if (id !== expected) {
      state.puzzle.library.clicks = [];
      saveState();
      updateProgress();
      setStatus("That ordering feels off. The shelf ‘resets’ itself.");
      playTone("bad");
      return;
    }

    state.puzzle.library.clicks = [...state.puzzle.library.clicks, id];
    saveState();
    updateProgress();

    if (state.puzzle.library.clicks.length === correct.length) {
      unlockFragment("frag2");
      markSolved("library");
      setStatus("A second fragment slips out like a bookmark.");
      playTone("unlock");
      setRoom("workshop");
      return;
    }

    setStatus("That feels closer…");
    playTone("ok");
  }

  for (const b of books) {
    const btn = el("button", {
      class: "book",
      type: "button",
      "data-book": b.id,
      text: b.label,
      disabled: !!state.solved.library,
      onclick: () => pushClick(b.id),
    });
    shelf.appendChild(btn);
  }

  updateProgress();

  const note = el("div", { class: "room__text" });
  note.innerHTML = 'Reward: <span class="kbd">Fragment II</span> will appear in the “Collected” panel.';

  return roomShell({
    kicker: "Room_03",
    title: "The Library",
    textNodes: [t1, shelf, progress, note],
    actions: [
      el("button", { class: "btn btn--ghost", type: "button", text: "Need a hint?", onclick: openHelp }),
      el("button", {
        class: "btn btn--ghost",
        type: "button",
        text: "Clear sequence",
        onclick: () => {
          state.puzzle.library.clicks = [];
          saveState();
          updateProgress();
          setStatus("Sequence cleared.");
        },
      }),
    ],
  });
}

function roomWorkshop() {
  const t1 = el("div", {
    class: "room__text",
    text:
      "The Workshop has a small ticket press. Three fragments want to snap into a familiar five-five-five shape.",
  });

  const tray = el("div", { class: "tray", role: "group", "aria-label": "Fragments tray" });
  const code = getAssembledCode();

  function renderSlots(container) {
    container.innerHTML = "";
    state.puzzle.workshop.slots.forEach((val, idx) => {
      const slot = el("button", {
        class: "slot",
        type: "button",
        "data-slot": idx,
        "aria-label": val ? `Slot ${idx + 1}, filled` : `Slot ${idx + 1}, empty`,
        onclick: () => {
          if (state.solved.workshop) return;
          state.puzzle.workshop.slots[idx] = "";
          saveState();
          renderSlots(container);
          setStatus("Slot cleared.");
        },
        ondragover: (e) => {
          e.preventDefault();
          slot.classList.add("slot--over");
        },
        ondragleave: () => slot.classList.remove("slot--over"),
        ondrop: (e) => {
          e.preventDefault();
          slot.classList.remove("slot--over");
          if (state.solved.workshop) return;
          const frag = e.dataTransfer?.getData("text/plain") ?? "";
          if (!frag) return;
          state.puzzle.workshop.slots[idx] = frag;
          saveState();
          renderSlots(container);
          evaluate();
        },
      });
      slot.textContent = val || "—";
      container.appendChild(slot);
    });
  }

  function nextEmptySlot() {
    return state.puzzle.workshop.slots.findIndex((s) => !s);
  }

  function evaluate() {
    const [a, b, c] = state.puzzle.workshop.slots;
    // If they place Fragment I + II correctly in the first two slots, reveal Fragment III.
    if (!state.fragmentsUnlocked.frag3 && a === KEY_FRAGMENTS.frag1 && b === KEY_FRAGMENTS.frag2) {
      unlockFragment("frag3");
      render(); // refresh tray to show the revealed fragment
      setStatus("Something new appears in the tray…");
      return;
    }

    const filled = a && b && c;
    if (!filled) {
      setStatus("Fragments placed.");
      playTone("ok");
      return;
    }

    const assembled = `${a}-${b}-${c}`;
    if (assembled === code) {
      markSolved("workshop");
      setStatus("Perfect fit. The final door warms.");
      playTone("unlock");
      setRoom("hearth");
      return;
    }

    setStatus("Almost. The shape is right, but the order is not.");
    playTone("bad");
  }

  const fragsToShow = [];
  if (state.fragmentsUnlocked.frag1) fragsToShow.push(KEY_FRAGMENTS.frag1);
  if (state.fragmentsUnlocked.frag2) fragsToShow.push(KEY_FRAGMENTS.frag2);
  // allow placing final fragment only once unlocked
  if (state.fragmentsUnlocked.frag3) fragsToShow.push(KEY_FRAGMENTS.frag3);
  else fragsToShow.push("?????");

  for (const frag of fragsToShow) {
    const card = el("button", {
      class: "fragCard",
      type: "button",
      text: frag,
      draggable: true,
      "aria-label": `Fragment ${frag}`,
      ondragstart: (e) => {
        if (frag === "?????") return;
        e.dataTransfer?.setData("text/plain", frag);
        e.dataTransfer.effectAllowed = "copyMove";
      },
      onclick: () => {
        if (state.solved.workshop) return;
        if (frag === "?????") {
          setStatus("That fragment is still hiding. Assemble the first two.");
          playTone("bad");
          return;
        }
        const idx = nextEmptySlot();
        if (idx < 0) {
          setStatus("All slots are filled. Click a slot to clear it.");
          return;
        }
        state.puzzle.workshop.slots[idx] = frag;
        saveState();
        renderSlots(slots);
        evaluate();
      },
    });
    tray.appendChild(card);
  }

  const slots = el("div", { class: "slots", role: "group", "aria-label": "Assembly slots" });
  renderSlots(slots);

  const note = el("div", { class: "room__text" });
  note.innerHTML =
    'Tip: you can drag fragments into slots, or simply click them. Reward: <span class="kbd">Fragment III</span> appears when the ticket is correct.';

  return roomShell({
    kicker: "Room_04",
    title: "The Workshop",
    textNodes: [t1, tray, slots, note],
    actions: [
      el("button", { class: "btn btn--ghost", type: "button", text: "Need a hint?", onclick: openHelp }),
      el("button", {
        class: "btn btn--ghost",
        type: "button",
        text: "Clear slots",
        onclick: () => {
          state.puzzle.workshop.slots = ["", "", ""];
          saveState();
          renderSlots(slots);
          setStatus("Slots cleared.");
        },
      }),
    ],
  });
}

function roomHearth() {
  const t1 = el("div", {
    class: "room__text",
    text:
      "By the Hearth, the air is warm and the blueprint ink finally looks like it was meant to become one thing.",
  });

  const code = getAssembledCode();
  const reveal = el("div", { class: "reveal" });
  reveal.appendChild(el("div", { class: "reveal__label", text: "Your Product Code" }));
  reveal.appendChild(el("div", { class: "reveal__code", text: code, id: "finalCode" }));

  const copyBtn = el("button", {
    class: "btn",
    type: "button",
    text: "Copy code",
    onclick: async () => {
      try {
        await navigator.clipboard.writeText(code);
        setStatus("Copied.");
        playTone("ok");
      } catch {
        setStatus("Copy not available here—select and copy the code manually.");
      }
    },
  });

  const subtle = el("div", { class: "room__text" });
  subtle.innerHTML =
    'Clues: it belongs in a <span class="kbd">Library</span> that is also a <span class="kbd">Store</span>. There’s an “Activate…” option under a <span class="kbd">Games</span> menu.';

  const help = el("details", { class: "howto" }, [
    el("summary", { class: "howto__summary", text: "Help me use this code" }),
    el("div", {
      class: "howto__body",
      text:
        "This code is redeemed inside a free app called Steam (it’s a game store + launcher). Once you redeem it, the game will appear in your Library.",
    }),
    el("div", { class: "howto__body" }, [
      el("div", { class: "howto__body", text: "Step-by-step:" }),
      el("div", {
        class: "howto__body",
        text:
          "1) Install Steam (on Mac or Windows). 2) Sign in (or create a free account). 3) In Steam, open: Games → Activate a Product on Steam… 4) Paste the code and continue.",
      }),
    ]),
    el("div", {
      class: "howto__body",
      text:
        "If you’d like, call/text Chris for 2 minutes and he’ll walk you through the first time — it’s easy once you’ve seen it.",
    }),
    el("div", { class: "howto__body" }, [
      el("a", {
        href: "https://store.steampowered.com/about/",
        target: "_blank",
        rel: "noopener noreferrer",
        class: "howto__link",
        text: "Steam download page",
      }),
    ]),
  ]);

  markSolved("hearth");

  return roomShell({
    kicker: "Room_05",
    title: "The Hearth",
    textNodes: [t1, reveal, subtle, help],
    actions: [copyBtn, el("button", { class: "btn btn--ghost", type: "button", text: "Need a hint?", onclick: openHelp })],
  });
}

function render() {
  sanitizeStateForUnlocks();
  applySettings();
  renderMap();
  renderFragments();
  renderRoom();
  renderHelp();
}

function wireUI() {
  // Map navigation
  for (const btn of $$(".map__room")) {
    btn.addEventListener("click", () => {
      const room = btn.getAttribute("data-room");
      if (room) setRoom(room);
    });
  }

  $("#btnHelp")?.addEventListener("click", openHelp);
  $("#btnSettings")?.addEventListener("click", openSettings);
  $("#btnReset")?.addEventListener("click", () => {
    const ok = window.confirm("Reset the tour progress for this browser?");
    if (ok) resetAll();
  });

  $("#btnHintNext")?.addEventListener("click", hintNext);
  $("#btnHintReset")?.addEventListener("click", hintReset);

  $("#toggleSound")?.addEventListener("change", (e) => {
    state.settings.sound = !!e.target.checked;
    saveState();
    setStatus(state.settings.sound ? "Sound enabled." : "Sound disabled.");
    if (state.settings.sound) playTone("ok");
  });
  $("#toggleReduceMotion")?.addEventListener("change", (e) => {
    state.settings.reduceMotion = !!e.target.checked;
    saveState();
    applySettings();
  });
  $("#toggleHighContrast")?.addEventListener("change", (e) => {
    state.settings.highContrast = !!e.target.checked;
    saveState();
    applySettings();
  });
}

// Snow (very lightweight)
function startSnow() {
  const canvas = $("#snow");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let w = 0;
  let h = 0;
  const flakes = [];
  const count = 90;

  function resize() {
    w = canvas.width = Math.floor(window.innerWidth * window.devicePixelRatio);
    h = canvas.height = Math.floor(window.innerHeight * window.devicePixelRatio);
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function init() {
    flakes.length = 0;
    for (let i = 0; i < count; i++) {
      flakes.push({
        x: rand(0, w),
        y: rand(0, h),
        r: rand(0.7, 2.2) * window.devicePixelRatio,
        s: rand(0.3, 1.3) * window.devicePixelRatio,
        dx: rand(-0.2, 0.2) * window.devicePixelRatio,
      });
    }
  }

  function tick() {
    const reduce = document.body.classList.contains("reduce-motion");
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(216,246,255,0.35)";
    for (const f of flakes) {
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();

      if (!reduce) {
        f.y += f.s;
        f.x += f.dx;
      }
      if (f.y > h + 10) f.y = -10;
      if (f.x < -10) f.x = w + 10;
      if (f.x > w + 10) f.x = -10;
    }
    window.requestAnimationFrame(tick);
  }

  resize();
  init();
  tick();
  window.addEventListener("resize", () => {
    resize();
    init();
  });
}

// boot
wireUI();
render();
startSnow();



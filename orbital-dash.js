/**
 * Orbital Dash: a circular Home Assistant panel for round (or any square-ish) displays.
 *
 * A ring of "planets" orbits the edge of the screen; tapping (or swiping) rotates the
 * ring so the active page sits at 12 o'clock. Pages render inside a central disc.
 *
 * Registered via panel_custom as <orbital-dash>. Everything personal (entities, rooms,
 * stations, backlight) comes from the panel_custom `config:` block, merged over DEFAULTS
 * below. Pages whose entities are not configured are left out of the ring.
 */

const DEFAULTS = {
  size: 1080,
  ringRadius: 468,
  // Language: a locale such as "en-GB", "nl-BE", "de" or "auto" (follow Home Assistant's language). It sets the date and time
  // format and picks the label set; built in: en, nl. Add or fix labels with `strings`, e.g. strings: { page_home: "Thuis" }
  language: "en-GB",
  strings: {},
  // true = 24-hour clock, false = 12-hour with am/pm
  clock24: true,
  // "round": the panel is a circle (round displays). "square": the background fills the whole screen (tablets, monitors); the ring and pages stay circular.
  shape: "round",
  // Pages in the ring, in order: any of home, lights, scenes, media, agenda, vacuum. null = all pages that have entities configured.
  pages: null,
  // Appearance. accents overrides a page's colour: { lights: "#ff8800" }. bg = the three stops of the background gradient.
  theme: {
    font: '"Inter", "Segoe UI", "Roboto", "Helvetica Neue", sans-serif',
    text: "#eaf2ff",
    muted: "#8da2cc",
    bg: ["#101a33", "#070b18", "#02030a"],
    page: null,   // colour outside the stage; null = black for round, the last bg colour for square
    zigzag: "#0c1226",
    stars: 70,
    accents: {},
  },
  // List config problems on the screen as well as in the browser console
  showWarnings: false,
  idleReturnMs: 60000,
  // How long the hourly forecast stays up after tapping the weather on Home
  hourlyShowMs: 12000,
  // Slowly turning dark zig-zag lines above the stars: they pass over them so they seem to twinkle (one GPU-composited layer)
  zigzag: { on: true, seconds: 150 },
  // Screensaver (anti burn-in ambient mode). After `afterMinutes` untouched the screen dims into "orrery" or "nightsky".
  // enabled: false = never. startWhen / wakeWhen add conditions on any entity, each { entity, state | above | below | changed }:
  //   startWhen: only start while it holds (e.g. presence off, a light on);  wakeWhen: wake as soon as it holds (e.g. presence on, an event fires).
  // A touch always wakes the screen. afterMinutes and mode fall back to idleAfterMs / idleMode (older option names).
  screensaver: { enabled: true, mode: null, afterMinutes: null, startWhen: null, wakeWhen: null },
  idleAfterMs: 5 * 60000,
  idleMode: "orrery",
  // Physical backlight: URL of a local listener that accepts GET ?pct=N (see hardware/). Empty = no backlight control.
  backlightUrl: "",
  idleBacklight: 10,
  activeBacklight: 100,
  // Optional ambient-light sensor (lx). The backlight follows it (log scale: darkLux and below = minBacklight,
  // brightLux and above = activeBacklight) and the screensaver only starts once the room is dark (<= idleLux), ending when it
  // brightens again (>= wakeLux). Without an entity or a reading the screensaver starts after idleAfterMs and the backlight stays at activeBacklight.
  ambient: { entity: null, darkLux: 2, brightLux: 120, minBacklight: 15, idleLux: 3, wakeLux: 8 },
  // Doorbell: an event entity that wakes the screen and shows an alert; doorLock adds an "open door" button
  doorbell: null,
  doorLock: null,
  bellShowMs: 45000,
  calendars: [],
  todo: null,
  shopping: null,
  weather: null,
  people: [],
  // Light preselected on the Lights page (e.g. a Hue Room group); not counted as a light of its own on Home
  defaultLight: null,
  // Lights to hide (e.g. a duplicate group)
  hiddenLights: [],
  // Scene grouping on the Scenes page: [["scene.living_room", "Living room"], ...] by entity-id prefix; everything else is "Scenes"
  sceneRooms: [],
  // Vacuum page, shown only when `id` is set. rooms: build them with tools/room-map-editor.html.
  // mapRotate turns the map (0, 90, -90, 180 degrees; the editor tells you which suits your map); mapView overrides the automatic "x y w h" viewBox.
  vacuum: { id: null, battery: null, water: null, area: null, duration: null, consumables: [], lowPct: 25, rooms: [], mapRotate: 0, mapView: null },
  // Quick-play stations on the Media page: play_media works on idle cast devices.
  // Cast devices fetch logos over the LAN, so publicUrl must be your HA address as seen from them.
  publicUrl: "",
  logoPath: "/local/orbital-dash/logos/",
  // Sensor written by a command_line sensor (stations that embed the song title in the stream); optional
  nowPlaying: null,
  favourites: [],
  mediaPlayers: [],
};

// Active config; replaced when HA hands us the panel config (see set panel)
let OD = DEFAULTS;
const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
const merge = (base, over) => {
  const out = { ...base };
  for (const k of Object.keys(over || {})) out[k] = isObj(base[k]) && isObj(over[k]) ? merge(base[k], over[k]) : over[k];
  return out;
};

// ---------- labels: the English set is the fallback for every other language ----------
const STRINGS = {
  en: {
    page_home: "Home", page_lights: "Lights", page_scenes: "Scenes", page_media: "Media", page_agenda: "Agenda", page_vacuum: "Clean",
    bell_title: "Someone's at the door", bell_open: "Open door", bell_confirm: "Tap again to open", bell_opening: "Opening…", bell_dismiss: "Dismiss",
    forecast_unavailable: "Forecast unavailable", hourly_aria: "Hourly forecast", back_to_weather: "Back to current weather",
    lights_on_one: "{n} light on · tap to turn off", lights_on_other: "{n} lights on · tap to turn off", lights_off: "Lights off",
    no_lights: "No lights found", no_lights_hint: "They may be off or unreachable. Check your lighting integration.",
    no_scenes: "No scenes", no_scenes_hint: "Create scenes in Home Assistant to see them here.", scenes_group: "Scenes",
    no_players: "No media players", no_players_hint: "No speakers or TVs are reachable right now.",
    media_starting: "Starting…", media_starting_hint: "This can take a few seconds", media_nothing: "Nothing playing", media_pick: "Pick a station to start",
    media_back: "Back", media_stations: "Stations", media_radio: "Radio", media_live: "live radio",
    vac_not_found: "Vacuum not found", vac_not_found_hint: "Check the vacuum entity in the panel config and its integration.",
    vac_cleaning: "Cleaning", vac_returning: "Returning to dock", vac_docked: "Docked", vac_paused: "Paused", vac_idle: "Idle", vac_error: "Needs attention", vac_unavailable: "Offline",
    vac_battery: "Battery {n}%", vac_worn: "{name} {n}% worn: replace soon", vac_last: "Last clean", vac_min: "min", vac_area: "m²",
    vac_suction: "Suction", vac_water: "Water", vac_suction_water: "Suction & water", vac_rooms: "Clean rooms", vac_clean: "Clean", vac_dock: "Dock", vac_locate: "Locate",
    vac_by_room: "Clean by room", vac_fail: "Couldn't start cleaning", vac_starting_one: "Starting: {n} room", vac_starting_other: "Starting: {n} rooms", back: "Back",
    today: "Today", tomorrow: "Tomorrow", yesterday: "Yesterday", days_late: "{n} days late", loading: "Loading…", nothing_coming: "Nothing coming up", all_done: "All done",
    next_up: "Next up", todo: "To do", shopping_one: "Shopping list: {n} item", shopping_other: "Shopping list: {n} items",
    wx_clear_night: "Clear night", wx_cloudy: "Cloudy", wx_exceptional: "Exceptional", wx_fog: "Fog", wx_hail: "Hail", wx_lightning: "Lightning",
    wx_lightning_rainy: "Thunderstorm", wx_partlycloudy: "Partly cloudy", wx_pouring: "Pouring", wx_rainy: "Rainy", wx_snowy: "Snowy",
    wx_snowy_rainy: "Sleet", wx_sunny: "Sunny", wx_windy: "Windy", wx_windy_variant: "Windy",
  },
  nl: {
    page_home: "Thuis", page_lights: "Lichten", page_scenes: "Scènes", page_media: "Media", page_agenda: "Agenda", page_vacuum: "Poetsen",
    bell_title: "Er staat iemand aan de deur", bell_open: "Deur openen", bell_confirm: "Tik nogmaals om te openen", bell_opening: "Openen…", bell_dismiss: "Negeren",
    forecast_unavailable: "Voorspelling niet beschikbaar", hourly_aria: "Voorspelling per uur", back_to_weather: "Terug naar huidig weer",
    lights_on_one: "{n} lamp aan · tik om uit te zetten", lights_on_other: "{n} lampen aan · tik om uit te zetten", lights_off: "Lichten uit",
    no_lights: "Geen lampen gevonden", no_lights_hint: "Ze staan misschien uit of zijn onbereikbaar. Controleer je verlichtingsintegratie.",
    no_scenes: "Geen scènes", no_scenes_hint: "Maak scènes in Home Assistant om ze hier te zien.", scenes_group: "Scènes",
    no_players: "Geen mediaspelers", no_players_hint: "Er zijn nu geen speakers of tv's bereikbaar.",
    media_starting: "Starten…", media_starting_hint: "Dit kan even duren", media_nothing: "Niets aan het spelen", media_pick: "Kies een zender om te starten",
    media_back: "Terug", media_stations: "Zenders", media_radio: "Radio", media_live: "live radio",
    vac_not_found: "Stofzuiger niet gevonden", vac_not_found_hint: "Controleer de stofzuiger-entiteit in de paneelconfig en de integratie.",
    vac_cleaning: "Aan het poetsen", vac_returning: "Terug naar dock", vac_docked: "In dock", vac_paused: "Gepauzeerd", vac_idle: "Inactief", vac_error: "Heeft aandacht nodig", vac_unavailable: "Offline",
    vac_battery: "Batterij {n}%", vac_worn: "{name} {n}% versleten: binnenkort vervangen", vac_last: "Laatste poetsbeurt", vac_min: "min", vac_area: "m²",
    vac_suction: "Zuigkracht", vac_water: "Water", vac_suction_water: "Zuigkracht & water", vac_rooms: "Kamers poetsen", vac_clean: "Poetsen", vac_dock: "Dock", vac_locate: "Zoek",
    vac_by_room: "Per kamer", vac_fail: "Poetsen starten mislukt", vac_starting_one: "Starten: {n} kamer", vac_starting_other: "Starten: {n} kamers", back: "Terug",
    today: "Vandaag", tomorrow: "Morgen", yesterday: "Gisteren", days_late: "{n} dagen te laat", loading: "Laden…", nothing_coming: "Niets gepland", all_done: "Alles gedaan",
    next_up: "Binnenkort", todo: "Te doen", shopping_one: "Boodschappenlijst: {n} item", shopping_other: "Boodschappenlijst: {n} items",
    wx_clear_night: "Heldere nacht", wx_cloudy: "Bewolkt", wx_exceptional: "Uitzonderlijk", wx_fog: "Mist", wx_hail: "Hagel", wx_lightning: "Bliksem",
    wx_lightning_rainy: "Onweer", wx_partlycloudy: "Half bewolkt", wx_pouring: "Plensbui", wx_rainy: "Regen", wx_snowy: "Sneeuw",
    wx_snowy_rainy: "Natte sneeuw", wx_sunny: "Zonnig", wx_windy: "Winderig", wx_windy_variant: "Winderig",
  },
};
// The locale for dates and times; "auto" follows Home Assistant's language (set from the hass object)
let HASS_LANG = "en-GB";
const locale = () => (OD.language === "auto" ? HASS_LANG : OD.language) || "en-GB";
// tx("lights_on", { n: 2 }) picks lights_on_one / lights_on_other by count when n is given; {name} placeholders are filled from vars
const tx = (key, vars = {}) => {
  const lang = locale().toLowerCase().split("-")[0];
  const tbl = { ...STRINGS.en, ...(STRINGS[lang] || {}), ...(OD.strings || {}) };
  let k = key;
  if ("n" in vars && (tbl[key + "_one"] || tbl[key + "_other"])) k = key + (vars.n === 1 ? "_one" : "_other");
  return String(tbl[k] ?? key).replace(/\{(\w+)\}/g, (_, v) => vars[v] ?? "");
};
// true when a label exists (English holds every built-in key)
const hasLabel = (k) => k in STRINGS.en || k in (OD.strings || {});
const timeParts = (d) => new Intl.DateTimeFormat(locale(), { hour: OD.clock24 ? "2-digit" : "numeric", minute: "2-digit", hour12: !OD.clock24 }).formatToParts(d);
const fmtTime = (d) => timeParts(d).map((p) => p.value).join("");
// Same, with am/pm as small text so a 12-hour clock keeps the width of a 24-hour one
const fmtTimeHtml = (d) => timeParts(d).map((p) => (p.type === "dayPeriod" ? `<small class="ap">${esc(p.value.trim())}</small>` : esc(p.value))).join("").replace(/[\s  ]+(?=<small)/, "");
const fmtDate = (d, opts = { weekday: "long", day: "numeric", month: "long" }) => d.toLocaleDateString(locale(), opts);

const CLOUD = '<path d="M7 14.5a3.8 3.8 0 0 1-.4-7.58 5.2 5.2 0 0 1 10 1A3.3 3.3 0 0 1 16.8 14.5z"/>';
const WX_ICON = {
  sunny: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/>',
  "clear-night": '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  cloudy: '<path d="M6.5 18.5a4.25 4.25 0 0 1-.4-8.48 6 6 0 0 1 11.5 1.2 3.65 3.65 0 0 1-.6 7.28z"/>',
  partlycloudy: '<circle cx="8" cy="8" r="2.8"/><path d="M8 2.2v1.3M2.2 8h1.3M3.9 3.9l.9.9M12.1 3.9l-.9.9"/><path d="M9.5 19.5a3.5 3.5 0 0 1-.3-6.98 5 5 0 0 1 9.6 1 3 3 0 0 1-.5 5.98z"/>',
  rainy: CLOUD + '<path d="M8 17.5l-1 2.5M12 17.5l-1 2.5M16 17.5l-1 2.5"/>',
  pouring: CLOUD + '<path d="M8.5 16.5l-1.2 4M12.5 16.5l-1.2 4M16.5 16.5l-1.2 4M10.5 17l-.8 3"/>',
  snowy: CLOUD + '<path d="M8 18h.01M12 18h.01M16 18h.01M10 21h.01M14 21h.01"/>',
  "snowy-rainy": CLOUD + '<path d="M8 17.5l-1 2.5M16 17.5l-1 2.5M12 18h.01M12 21h.01"/>',
  hail: CLOUD + '<path d="M8 18h.01M12 19h.01M16 18h.01M10 21.5h.01M14 21.5h.01"/>',
  lightning: CLOUD + '<path d="M12.8 14.5l-2.6 3.5h3.2l-2 3.5"/>',
  "lightning-rainy": CLOUD + '<path d="M12.8 14.5l-2.6 3.5h3.2l-2 3.5M7.5 17.5l-.8 2.2M17 17.5l-.8 2.2"/>',
  fog: '<path d="M4 8h16M6 12h12M4 16h16M8 20h8"/>',
  windy: '<path d="M3 9h11a2.5 2.5 0 1 0-2.5-2.5M3 13h15a2.5 2.5 0 1 1-2.5 2.5M3 17h7"/>',
  exceptional: '<path d="M12 4 3 20h18zM12 10v4.5M12 17.5h.01"/>',
};
WX_ICON["windy-variant"] = WX_ICON.windy;

const ALL_PAGES = [
  { id: "home", label: "Home", accent: "#5ef0ff", icon: '<path d="M4 11.5 12 4l8 7.5V20h-5.5v-5.5h-5V20H4z"/>' },
  { id: "lights", label: "Lights", accent: "#ffb454", icon: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>' },
  { id: "scenes", label: "Scenes", accent: "#a78bfa", icon: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>' },
  { id: "media", label: "Media", accent: "#ff6b9a", icon: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l6-3.5z"/>' },
  { id: "agenda", label: "Agenda", accent: "#6ea8ff", icon: '<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16M9 3v4M15 3v4"/>' },
  { id: "vacuum", label: "Clean", accent: "#4ade80", icon: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.6"/><path d="M12 3.5V6"/>' },
];
// ---------- config checks: warn in the console (and on screen with showWarnings) about mistakes in `config:` ----------
const WARNINGS = [];
const warn = (msg) => { if (!WARNINGS.includes(msg)) { WARNINGS.push(msg); console.warn("[orbital-dash] " + msg); } };
const lev = (a, b) => {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
};
const didYouMean = (k, known) => { const m = known.map((x) => [lev(k.toLowerCase(), x.toLowerCase()), x]).sort((a, b) => a[0] - b[0])[0]; return m && m[0] <= 2 ? ` (did you mean "${m[1]}"?)` : ""; };
const ENTITY_RE = /^[a-z0-9_]+\.[a-z0-9_]+$/;
// Every entity id the config mentions: [config path, id, mustExist]
const entityRefs = (c) => {
  const out = [], one = (p, v, must = true) => { if (typeof v === "string" && v) out.push([p, v, must]); };
  ["doorbell", "doorLock", "todo", "shopping", "weather", "defaultLight", "nowPlaying"].forEach((k) => one(k, c[k]));
  ["calendars", "people", "mediaPlayers"].forEach((k) => (Array.isArray(c[k]) ? c[k] : []).forEach((v, i) => one(`${k}[${i}]`, v)));
  (Array.isArray(c.hiddenLights) ? c.hiddenLights : []).forEach((v, i) => one(`hiddenLights[${i}]`, v, false));
  one("ambient.entity", c.ambient?.entity);
  one("screensaver.startWhen.entity", c.screensaver?.startWhen?.entity);
  one("screensaver.wakeWhen.entity", c.screensaver?.wakeWhen?.entity);
  ["id", "battery", "water", "area", "duration"].forEach((k) => one(`vacuum.${k}`, c.vacuum?.[k]));
  (Array.isArray(c.vacuum?.consumables) ? c.vacuum.consumables : []).forEach((x, i) => one(`vacuum.consumables[${i}]`, Array.isArray(x) ? x[1] : x));
  return out;
};
const checkConfig = (user) => {
  const known = (path, obj, ref) => Object.keys(obj || {}).forEach((k) => {
    if (!(k in ref)) warn(`unknown option "${path}${k}"${didYouMean(k, Object.keys(ref))}`);
  });
  known("", user, DEFAULTS);
  ["theme", "zigzag", "ambient", "vacuum", "screensaver"].forEach((k) => { if (isObj(user[k])) known(k + ".", user[k], DEFAULTS[k]); });
  for (const k of Object.keys(user)) {
    const d = DEFAULTS[k], v = user[k];
    if (d === undefined || v === null || v === undefined) continue;
    if (Array.isArray(d) && !Array.isArray(v)) warn(`"${k}" should be a list, got ${JSON.stringify(v)}`);
    else if (isObj(d) && !isObj(v)) warn(`"${k}" should be a mapping, got ${JSON.stringify(v)}`);
    else if (typeof d === "number" && typeof v !== "number") warn(`"${k}" should be a number, got ${JSON.stringify(v)}`);
    else if (typeof d === "boolean" && typeof v !== "boolean") warn(`"${k}" should be true or false, got ${JSON.stringify(v)}`);
  }
  if (isObj(user.strings)) Object.keys(user.strings).forEach((k) => { if (!(k in STRINGS.en)) warn(`unknown label "strings.${k}"${didYouMean(k, Object.keys(STRINGS.en))}`); });
  if (user.language != null && typeof user.language !== "string") warn(`"language" should be a locale such as "en-GB" or "auto"`);
  if (user.vacuum?.mapRotate != null && ![0, 90, -90, 180].includes(user.vacuum.mapRotate)) warn(`vacuum.mapRotate should be 0, 90, -90 or 180, got ${JSON.stringify(user.vacuum.mapRotate)}`);
  ["startWhen", "wakeWhen"].forEach((k) => {
    const c = user.screensaver?.[k]; if (c == null) return;
    if (!isObj(c) || typeof c.entity !== "string") { warn(`screensaver.${k} needs an entity, e.g. { entity: binary_sensor.presence, state: "on" }`); return; }
    known(`screensaver.${k}.`, c, { entity: 0, state: 0, above: 0, below: 0, changed: 0 });
    if (c.state === undefined && c.above === undefined && c.below === undefined && !c.changed) warn(`screensaver.${k} has no condition: add state, above, below or changed`);
    if (k === "startWhen" && c.changed) warn("screensaver.startWhen.changed only holds for a moment, so it hardly ever starts the screensaver; use it under wakeWhen");
    ["above", "below"].forEach((n) => { if (c[n] !== undefined && typeof c[n] !== "number") warn(`screensaver.${k}.${n} should be a number`); });
  });
  if (user.screensaver && user.screensaver.afterMinutes != null && typeof user.screensaver.afterMinutes !== "number") warn(`screensaver.afterMinutes should be a number of minutes`);
  if (user.screensaver && user.screensaver.mode != null && !["orrery", "nightsky"].includes(user.screensaver.mode)) warn(`screensaver.mode should be "orrery" or "nightsky"`);
  if (user.shape != null && !["round", "square"].includes(user.shape)) warn(`shape should be "round" or "square", got ${JSON.stringify(user.shape)}`);
  if (user.pages != null) {
    if (!Array.isArray(user.pages)) warn(`"pages" should be a list of page ids (${ALL_PAGES.map((p) => p.id).join(", ")})`);
    else user.pages.forEach((id) => { if (!ALL_PAGES.some((p) => p.id === id)) warn(`unknown page "${id}" in pages${didYouMean(String(id), ALL_PAGES.map((p) => p.id))}`); });
  }
  ["doorbell", "doorLock", "todo", "shopping", "weather", "defaultLight", "nowPlaying"].forEach((k) => { if (user[k] != null && typeof user[k] !== "string") warn(`"${k}" should be a single entity id`); });
  entityRefs(user).forEach(([p, id]) => { if (!ENTITY_RE.test(id)) warn(`${p}: "${id}" does not look like an entity id (domain.object_id)`); });
  (Array.isArray(user.favourites) ? user.favourites : []).forEach((f, i) => { if (!f?.name || !f?.url) warn(`favourites[${i}] needs at least name and url`); });
  (Array.isArray(user.vacuum?.rooms) ? user.vacuum.rooms : []).forEach((r, i) => { if (!r?.id || !r?.p) warn(`vacuum.rooms[${i}] needs id and p (polygon points)`); });
  if (user.vacuum && !user.vacuum.id && (user.vacuum.rooms?.length || user.vacuum.battery)) warn("vacuum is configured without vacuum.id, so the Clean page is hidden");
};
// Entities that are not in Home Assistant at all (a typo, or a removed device); unavailable ones are fine
const checkEntities = (states) => entityRefs(OD).forEach(([p, id, must]) => { if (must && ENTITY_RE.test(id) && !(id in states)) warn(`${p}: entity "${id}" not found in Home Assistant`); });

// Pages without their entities are left out of the ring; `pages` picks and orders them, theme.accents recolours them
const hasEntities = (p, c) => (p.id === "vacuum" ? !!c.vacuum?.id : p.id === "agenda" ? !!(c.calendars?.length || c.todo || c.shopping) : true);
const pagesFor = (c) => {
  const want = Array.isArray(c.pages) ? c.pages.map((id) => ALL_PAGES.find((p) => p.id === id)).filter(Boolean) : ALL_PAGES;
  let list = want.filter((p) => hasEntities(p, c));
  if (Array.isArray(c.pages)) want.filter((p) => !hasEntities(p, c)).forEach((p) => warn(`page "${p.id}" is listed in pages but has no entities configured, so it is hidden`));
  if (!list.length) { warn("no pages left to show; showing all pages"); list = ALL_PAGES.filter((p) => hasEntities(p, c)); }
  return list.map((p) => ({ ...p, label: tx("page_" + p.id), accent: c.theme?.accents?.[p.id] || p.accent }));
};
let PAGES = pagesFor(OD);
let STEP = 360 / PAGES.length;
const applyConfig = (cfg) => {
  const { _panel_custom, ...user } = cfg || {};
  checkConfig(user);
  OD = merge(DEFAULTS, user);
  // a single id where a list is expected still works
  ["calendars", "people", "mediaPlayers", "hiddenLights", "favourites"].forEach((k) => { if (!Array.isArray(OD[k])) OD[k] = typeof OD[k] === "string" ? [OD[k]] : []; });
  PAGES = pagesFor(OD);
  STEP = 360 / PAGES.length;
};

// One colour slider: warm to cool whites first (colour temperature), then the full hue wheel
const K_MIN = 2200, K_MAX = 6500, K_STOPS = [[2200, "#ffb35c"], [2700, "#ffc98a"], [4000, "#fff1de"], [6500, "#cfe3ff"]], HUE_SAT = 85;
const mixHex = (a, b, t) => "#" + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, "0")).join("");
const kelvinCss = (k) => { for (let i = 1; i < K_STOPS.length; i++) if (k <= K_STOPS[i][0] || i === K_STOPS.length - 1) { const [k0, c0] = K_STOPS[i - 1], [k1, c1] = K_STOPS[i]; return mixHex(c0, c1, Math.max(0, Math.min(1, (k - k0) / (k1 - k0)))); } };
// share of the bar given to whites ("w"): 0 = hue only, 1 = whites only
const hueAt = (p, w) => {
  if (p < w || w === 1) { const k = Math.round(K_MIN + (p / (w || 1)) * (K_MAX - K_MIN)); return { css: kelvinCss(k), data: { color_temp_kelvin: k } }; }
  const h = Math.round(((p - w) / (1 - w)) * 360); return { css: `hsl(${h} 100% 58%)`, data: { hs_color: [h, HUE_SAT] } };
};
const hueBar = (w) => {
  const st = [];
  if (w > 0) K_STOPS.forEach(([k, c]) => st.push(`${c} ${(w * ((k - K_MIN) / (K_MAX - K_MIN)) * 100).toFixed(1)}%`));
  if (w < 1) for (let i = 0; i <= 6; i++) st.push(`hsl(${i * 60} 100% 58%) ${((w + (1 - w) * (i / 6)) * 100).toFixed(1)}%`);
  return `linear-gradient(90deg, ${st.join(", ")})`;
};

// A URL for CSS url("..."): http(s) or a path only, quotes/brackets/backslashes percent-encoded. Anything else gives "".
const cssUrl = (u) => {
  const v = String(u ?? "").trim();
  if (!/^(https?:\/\/|\/(?!\/))/i.test(v)) return "";
  return encodeURI(v).replace(/['"()\\]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
};
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const titleCase = (s) => String(s || "").replace(/[-_]/g, " ").replace(/^./, (c) => c.toUpperCase());

const CSS = `
:host { display:block; width:100vw; height:100vh; background:var(--od-page,#000); overflow:hidden; position:relative;
  font-family: var(--od-font, "Inter","Segoe UI","Roboto","Helvetica Neue",sans-serif); color:var(--od-text,#eaf2ff); -webkit-tap-highlight-color:transparent; user-select:none; }
* { box-sizing:border-box; }
.stage { position:absolute; left:50%; top:50%; width:1080px; height:1080px; margin:-540px 0 0 -540px;
  transform:scale(var(--k,1)); border-radius:var(--od-radius,50%); overflow:hidden; --accent:#5ef0ff;
  background: radial-gradient(circle at 50% 42%, var(--od-bg1,#101a33) 0%, var(--od-bg2,#070b18) var(--od-s2,55%), var(--od-bg3,#02030a) var(--od-s3,100%)); touch-action:pan-y; }
.stars, .orbits, .ring { position:absolute; inset:0; }
.cfgwarn { position:absolute; left:50%; bottom:168px; transform:translateX(-50%); width:470px; max-height:150px; overflow:hidden; z-index:60; pointer-events:none; text-align:center; font-size:16px; line-height:1.3; color:#ffb454; text-shadow:0 0 6px #000; }
.orbits svg, .stars svg { width:100%; height:100%; }
.zz { mix-blend-mode:darken; position:absolute; left:50%; top:50%; width:1600px; height:1600px; margin:-800px 0 0 -800px; pointer-events:none; will-change:transform; animation:zzspin 150s linear infinite; }
.zz svg { width:100%; height:100%; display:block; }
@keyframes zzspin { to { transform:rotate(360deg); } }
.spin { transform-origin:540px 540px; animation: spin 240s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }
.glow { position:absolute; left:50%; top:50%; width:820px; height:820px; margin:-410px 0 0 -410px; border-radius:50%;
  background: radial-gradient(circle, color-mix(in srgb, var(--accent) 16%, transparent) 0%, transparent 68%); transition:background .8s; }
.ring { transition: transform .85s cubic-bezier(.3,.9,.25,1); }
.node { position:absolute; left:50%; top:50%; width:104px; height:104px; margin:-52px 0 0 -52px; }
.node .in { width:100%; height:100%; transition: transform .85s cubic-bezier(.3,.9,.25,1); }
.node button { width:100%; height:100%; border-radius:50%; border:1.5px solid rgba(160,190,255,.25); background:rgba(14,22,44,.85);
  color:#9fb4dd; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; font:inherit; font-size:15px; letter-spacing:.04em;
  transition: transform .15s ease-out, color .5s, border-color .5s, background .5s, box-shadow .5s; padding:0; overflow:visible; }
.node svg { width:38px; height:38px; fill:none; stroke:currentColor; stroke-width:1.7; stroke-linecap:round; stroke-linejoin:round; }
.node.active button { border-color:var(--nc); color:var(--nc); background:rgba(18,28,56,.95); box-shadow:0 0 36px color-mix(in srgb, var(--nc) 55%, transparent), inset 0 0 22px color-mix(in srgb, var(--nc) 18%, transparent); transform:scale(1.14); }
.marker { position:absolute; left:50%; top:2px; width:0; height:0; margin-left:-12px; border-left:12px solid transparent; border-right:12px solid transparent;
  border-top:16px solid var(--accent); filter:drop-shadow(0 0 8px var(--accent)); transition:border-top-color .8s; }
.disc { position:absolute; left:50%; top:50%; width:790px; height:790px; margin:-395px 0 0 -395px; border-radius:50%;
  background: radial-gradient(circle at 50% 30%, rgba(30,44,84,.5), rgba(8,12,26,.85)); border:1.5px solid rgba(150,180,255,.14);
  box-shadow: 0 0 80px rgba(0,0,0,.6), inset 0 0 60px rgba(100,140,255,.06); display:flex; align-items:center; justify-content:center; overflow:hidden; }
.page { width:560px; display:flex; flex-direction:column; align-items:center; gap:18px; animation: fade .5s both; }
@keyframes fade { from { opacity:0; transform:scale(.97); } to { opacity:1; transform:none; } }
.dim { color:var(--od-muted,#8da2cc); }
.h-time small, .fc .ct small { font-size:.26em; font-weight:300; letter-spacing:.02em; margin-left:.18em; }
.h-time, .fc .ct { white-space:nowrap; }
.h-time { font-size:176px; font-weight:200; letter-spacing:-.03em; line-height:1; font-variant-numeric:tabular-nums; text-shadow:0 0 50px color-mix(in srgb, var(--accent) 45%, transparent); }
.h-date { font-size:32px; font-weight:300; letter-spacing:.06em; text-transform:uppercase; color:#b6c6e6; margin-top:0; }
.page.home { position:relative; }
.h-below { position:absolute; left:-100px; right:-100px; top:100%; display:flex; flex-direction:column; align-items:center; gap:12px; margin-top:30px; }
.h-above { position:absolute; left:-100px; right:-100px; bottom:100%; display:flex; justify-content:center; margin-bottom:30px; }
.h-weather { display:flex; align-items:center; gap:22px; font-size:30px; background:none; border:0; color:inherit; font-family:inherit; padding:4px 16px; }
.h-hours { display:flex; gap:6px; background:none; border:0; color:inherit; font-family:inherit; padding:0; }
.hr { display:flex; flex-direction:column; align-items:center; gap:2px; width:104px; } .hr i { font-style:normal; font-size:21px; color:var(--od-muted,#8da2cc); } .hr b { font-size:30px; font-weight:400; color:#fff; }
.hr svg { width:46px; height:46px; fill:none; stroke:var(--accent); stroke-width:1.6; stroke-linecap:round; stroke-linejoin:round; }
.wx { display:flex; flex-direction:column; align-items:center; gap:0; } .wx svg { width:64px; height:64px; fill:none; stroke:var(--accent); stroke-width:1.6; stroke-linecap:round; stroke-linejoin:round; }
.h-weather b { font-size:62px; font-weight:300; color:var(--accent); }
.chips { display:flex; flex-wrap:wrap; justify-content:center; gap:12px; }
.chip { border:1.5px solid rgba(160,190,255,.22); background:rgba(20,32,62,.7); color:#cfdcf7; border-radius:999px; padding:12px 24px; font:inherit; font-size:25px; min-height:56px; display:flex; align-items:center; gap:10px; }
.chip.on { border-color:var(--accent); color:#fff; background:color-mix(in srgb, var(--accent) 22%, rgba(20,32,62,.8)); box-shadow:0 0 22px color-mix(in srgb, var(--accent) 30%, transparent); }
.dot { width:14px; height:14px; border-radius:50%; background:#5a6a8c; flex:none; }
.dot.ok { background:#4ade80; box-shadow:0 0 10px #4ade80; } .dot.warn { background:#ffb454; box-shadow:0 0 10px #ffb454; }
.people { position:absolute; top:62px; left:50%; transform:translateX(-50%); display:flex; gap:14px; }
.ini { width:46px; height:46px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:21px; font-weight:500; color:#8a97b4; border:2px solid #5a6a8c; background:rgba(20,32,62,.7); }
.ini.ok { color:#fff; border-color:#4ade80; box-shadow:0 0 12px color-mix(in srgb, #4ade80 55%, transparent); }
.dial { position:relative; width:400px; height:400px; touch-action:none; }
.dial svg { width:100%; height:100%; overflow:visible; }
.dial .mid { position:absolute; inset:70px; border-radius:50%; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; cursor:pointer; }
.dial .pct { font-size:92px; font-weight:200; line-height:1; } .dial .pct small { font-size:34px; color:var(--od-muted,#8da2cc); }
.dial .nm { font-size:24px; color:var(--od-muted,#8da2cc); max-width:240px; text-align:center; }
.pwr { margin-top:6px; width:62px; height:62px; border-radius:50%; border:1.5px solid rgba(160,190,255,.3); display:flex; align-items:center; justify-content:center; }
.pwr svg { width:30px; height:30px; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; }
.on .pwr { color:var(--accent); border-color:var(--accent); box-shadow:0 0 20px color-mix(in srgb, var(--accent) 50%, transparent); }
input.hue[type=range] { width:440px; } input.hue[type=range]::-webkit-slider-runnable-track { height:22px; border-radius:11px; background:var(--bar); }
input.hue[type=range]::-webkit-slider-thumb { margin-top:-11px; width:44px; height:44px; background:var(--tc); border:4px solid #fff; box-shadow:0 0 18px var(--tc); }
.scene-grid { display:flex; flex-wrap:wrap; justify-content:center; gap:12px; max-height:430px; overflow-y:auto; padding:6px; width:560px; scrollbar-width:none; touch-action:pan-y;
  -webkit-mask-image:linear-gradient(transparent 0, #000 22px, #000 calc(100% - 22px), transparent 100%); mask-image:linear-gradient(transparent 0, #000 22px, #000 calc(100% - 22px), transparent 100%); }
.scene-grid::-webkit-scrollbar { display:none; }
.scene { padding:14px 22px; border-radius:20px; font-size:25px; border:1.5px solid rgba(167,139,250,.28); background:rgba(40,30,80,.5); color:#ddd4ff; font-family:inherit; min-height:64px; transition:transform .12s ease-out, background .25s, color .25s; }
.scene.fired { background:var(--accent); color:#10061f; transform:scale(.96); }
.title { font-size:26px; letter-spacing:.12em; text-transform:uppercase; color:var(--accent); }
.art { width:250px; height:250px; border-radius:50%; background:#0d1428 center/cover; border:3px solid rgba(255,107,154,.5); box-shadow:0 0 50px rgba(255,107,154,.25); position:relative; flex:none; }
.art::after { content:""; position:absolute; left:50%; top:50%; width:44px; height:44px; margin:-22px 0 0 -22px; border-radius:50%; background:#070b18; border:2px solid rgba(255,255,255,.2); }
.art.playing { animation: spin 14s linear infinite; }
.m-title { font-size:34px; font-weight:500; text-align:center; max-width:520px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.mq { text-overflow:clip !important; } .mq > span { display:inline-block; animation:mq 9s ease-in-out infinite alternate; }
@keyframes mq { 0%, 15% { transform:translateX(0); } 85%, 100% { transform:translateX(var(--mq)); } }
.m-sub { font-size:25px; text-align:center; max-width:520px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ctrls { display:flex; align-items:center; gap:26px; }
.cb { width:78px; height:78px; border-radius:50%; border:1.5px solid rgba(160,190,255,.3); background:rgba(20,32,62,.7); color:#eaf2ff; display:flex; align-items:center; justify-content:center; padding:0; }
.cb.big { width:104px; height:104px; border-color:var(--accent); color:var(--accent); box-shadow:0 0 30px color-mix(in srgb, var(--accent) 35%, transparent); }
.cb:disabled, .chip:disabled { opacity:.4; }
.vring { position:relative; width:260px; height:260px; flex:none; } .vring svg { position:absolute; left:-32.5px; top:-32.5px; width:325px; height:325px; overflow:visible; pointer-events:none; }
.vring.working .vsweep { transform-origin:120px 120px; animation:spin 2.6s linear infinite; }
.vlabel { font-size:42px; font-weight:400; text-align:center; line-height:1.1; max-width:200px; } .vstat { font-size:22px; margin-top:6px; text-align:center; max-width:190px; }
.chip.go { background:var(--accent); border-color:var(--accent); color:#04101c; font-weight:600; padding:12px 40px; min-height:64px; box-shadow:0 0 26px color-mix(in srgb, var(--accent) 45%, transparent); }
.chip.go:disabled { background:rgba(20,32,62,.7); border-color:rgba(160,190,255,.22); color:#cfdcf7; box-shadow:none; }
.vmap { width:700px; max-height:430px; flex:none; touch-action:manipulation; }
.vmap .room { fill:var(--c); fill-opacity:.2; stroke:rgba(190,210,255,.5); stroke-width:var(--sw,5); stroke-linejoin:round; transition:fill-opacity .2s, stroke .2s; }
.vmap .room:active { fill-opacity:.4; }
.vmap .room.on { fill:var(--accent); fill-opacity:.62; stroke:#fff; stroke-width:calc(var(--sw,5) * 1.2); }
.vmap .ric { pointer-events:none; } .vmap .ric path { fill:none; stroke:#eaf2ff; stroke-width:1.7; stroke-linecap:round; stroke-linejoin:round; }
.vsub { font-size:32px; color:var(--od-muted,#8da2cc); letter-spacing:.04em; }
.vtoast { color:var(--accent); font-size:26px; margin-top:-4px; text-align:center; } .vtoast.bad { color:#ff8a80; }
.vnote { color:#ffb454; font-size:24px; margin-top:-4px; text-align:center; }
.vc { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
.lbl { font-size:20px; align-self:center; margin-right:2px; }
.chip.sm { padding:8px 16px; font-size:22px; min-height:48px; }
.art.small { width:150px; height:150px; }
.art.logo { background-color:#fff; } .art.logo::after { display:none; }
.favs { display:grid; grid-template-columns:1fr 1fr; gap:12px; width:500px; }
.fav { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; padding:12px 10px; min-height:84px; border-radius:22px; font-family:inherit; color:#ffe3ec;
  border:1.5px solid rgba(255,107,154,.35); background:rgba(70,24,44,.5); } .fav b { font-size:30px; font-weight:500; } .fav span { font-size:20px; color:#d6a5b8; }
.cb svg { width:36px; height:36px; fill:currentColor; } .cb.big svg { width:48px; height:48px; }
input[type=range] { -webkit-appearance:none; appearance:none; width:380px; height:56px; background:transparent; outline:none; margin:0; }
input[type=range]::-webkit-slider-runnable-track { height:12px; border-radius:6px; background:rgba(160,190,255,.2); }
input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; margin-top:-14px; width:40px; height:40px; border-radius:50%; background:var(--accent); box-shadow:0 0 16px var(--accent); }
.row { width:100%; display:flex; align-items:center; gap:16px; padding:11px 22px; border-radius:20px; background:rgba(20,32,62,.55); border:1px solid rgba(160,190,255,.12); font-size:26px; min-height:64px; font-family:inherit; color:inherit; text-align:left; }
.row .t { flex:1; min-width:0; line-height:1.15; overflow:hidden; display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; }
.row.ev { box-shadow:inset 4px 0 0 color-mix(in srgb, var(--accent) 70%, transparent); }
.w2 { display:flex; flex-direction:column; align-items:flex-end; white-space:nowrap; line-height:1.15; } .w2 b { font-size:22px; font-weight:500; color:#cfdcf7; } .w2 b.now { color:var(--accent); } .w2 i { font-style:normal; font-size:20px; color:var(--od-muted,#8da2cc); } .row .w { font-size:22px; color:var(--od-muted,#8da2cc); white-space:nowrap; }
.row.ph { justify-content:center; color:var(--od-muted,#8da2cc); background:rgba(20,32,62,.3); }
.row .cbx { width:30px; height:30px; border-radius:9px; border:2px solid var(--accent); flex:none; }
/* Touch feedback: transform/opacity only, so it stays on the GPU */
button { position:relative; overflow:hidden; transition:transform .12s ease-out; }
.mid { overflow:hidden; transition:transform .12s ease-out; }
button.pressed, .mid.pressed { transform:scale(.9); transition-duration:.07s; }
.row.pressed { transform:scale(.97); }
.node.active button.pressed { transform:scale(1.02); }
.ripple { position:absolute; border-radius:50%; background:rgba(255,255,255,.55); pointer-events:none; opacity:0; transform:translate(-50%,-50%) scale(0); animation:rip .6s ease-out forwards; }
@keyframes rip { from { opacity:.55; transform:translate(-50%,-50%) scale(0); } to { opacity:0; transform:translate(-50%,-50%) scale(1); } }
.node button::after { content:""; position:absolute; inset:-3px; border-radius:50%; border:3px solid var(--nc); opacity:0; pointer-events:none; }
.node button.pulse::after { animation:ringp .7s ease-out; }
@keyframes ringp { from { opacity:1; transform:scale(1); } to { opacity:0; transform:scale(1.9); } }
.bump { animation:bump .32s ease-out; }
@keyframes bump { 0% { transform:scale(.94); } 45% { transform:scale(1.08); } 100% { transform:scale(1); } }
.bell { position:absolute; inset:0; border-radius:var(--od-radius,50%); background:radial-gradient(circle at 50% 45%,#2a160c,#07090f 70%); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:20px;
  opacity:0; pointer-events:none; transition:opacity .3s; text-align:center; }
.bell.on { opacity:1; pointer-events:auto; }
.bell * { animation-play-state:paused; } .bell.on * { animation-play-state:running; }
.bell-ic { position:relative; width:190px; height:190px; border-radius:50%; border:3px solid #ffb454; color:#ffb454; display:flex; align-items:center; justify-content:center; background:rgba(255,180,84,.08); }
.bell-ic svg { width:96px; height:96px; fill:none; stroke:currentColor; stroke-width:1.6; stroke-linecap:round; stroke-linejoin:round; }
.bell-ic::before, .bell-ic::after { content:""; position:absolute; inset:-3px; border-radius:50%; border:3px solid #ffb454; opacity:0; animation:bring 2s ease-out infinite; }
.bell-ic::after { animation-delay:1s; } @keyframes bring { from { opacity:.8; transform:scale(1); } to { opacity:0; transform:scale(1.9); } }
.bell h2 { margin:0; font-size:52px; font-weight:300; } .bell .sub { font-size:26px; color:#c9a27a; margin-top:-8px; }
.bbtn { min-width:360px; justify-content:center; font-size:32px; min-height:86px; }
.bbtn.primary { border-color:#ffb454; background:rgba(255,180,84,.2); color:#fff; }
.idle { position:absolute; inset:0; border-radius:var(--od-radius,50%); background:radial-gradient(circle at 50% 50%,#05070f,#010208); opacity:0; pointer-events:none; transition:opacity .5s; overflow:hidden; }
.idle.on { opacity:1; pointer-events:auto; transition-duration:3s; }
.idle * { animation-play-state:paused !important; } .idle.on * { animation-play-state:running !important; }
.idle-in { position:absolute; inset:0; opacity:.55; }
.idle svg { position:absolute; inset:0; width:100%; height:100%; }
.orb { position:absolute; inset:0; animation:orbit 780s linear infinite; }
.orb2 { position:absolute; inset:0; animation:orbit 1500s linear infinite reverse; }
@keyframes orbit { to { transform:rotate(360deg); } }
.pl { position:absolute; left:50%; top:50%; width:64px; height:64px; margin:-32px 0 0 -32px; transform:rotate(calc(var(--a)*1deg)) translateY(-468px); }
.pl i { display:flex; width:100%; height:100%; border-radius:50%; border:1.5px solid var(--c); color:var(--c); background:rgba(10,16,34,.8);
  align-items:center; justify-content:center; box-shadow:0 0 26px color-mix(in srgb, var(--c) 45%, transparent); animation:counter 780s linear infinite; }
.pl svg { position:static; width:30px; height:30px; fill:none; stroke:currentColor; stroke-width:1.7; stroke-linecap:round; stroke-linejoin:round; }
@keyframes counter { from { transform:rotate(calc(var(--a)*-1deg)); } to { transform:rotate(calc(var(--a)*-1deg - 360deg)); } }
.tw { animation:twinkle 6s ease-in-out infinite; } @keyframes twinkle { 0%,100% { opacity:.12; } 50% { opacity:.8; } }
.sky { transform-origin:540px 540px; animation:orbit 2400s linear infinite; }
.fc { position:absolute; left:50%; top:50%; transition:transform 1s linear; text-align:center; }
.fc .ct { font-size:132px; font-weight:200; letter-spacing:-.02em; line-height:1; font-variant-numeric:tabular-nums; transition:color 30s; }
.fc .cd { font-size:26px; letter-spacing:.1em; text-transform:uppercase; color:#7d8fb5; margin-top:4px; }
.shoot { stroke:#fff; stroke-width:2; stroke-linecap:round; opacity:0; animation:shoot 1.4s ease-out forwards; }
@keyframes shoot { 0% { opacity:0; transform:translate(0,0); } 15% { opacity:.9; } 100% { opacity:0; transform:translate(220px,120px); } }
.nostate { text-align:center; gap:8px; } .nostate b { font-size:34px; font-weight:400; color:#cfdcf7; } .nostate span { font-size:24px; color:var(--od-muted,#8da2cc); max-width:420px; line-height:1.25; }
.sec { width:100%; display:flex; flex-direction:column; gap:10px; } .empty { font-size:24px; padding:10px 22px; }
`;

class OrbitalDash extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.steps = 0;
    this.sel = { light: null, player: null, sceneRoom: "all" };
    this._sig = "";
    this._agenda = { events: [], todos: [], shoppingCount: 0, at: 0 };
    this._lastTouch = Date.now();
  }

  connectedCallback() {
    if (this._built) return;
    this._built = true;
    this._build();
    this._ro = new ResizeObserver(() => this._fit());
    this._ro.observe(this);
    this._clock = setInterval(() => { this._tickClock(); this._idleCheck(); this._stepBacklight(); }, 1000);
    this._go(0);
    this._fit();
    this._stepBacklight(true);
  }
  disconnectedCallback() { clearInterval(this._clock); this._ro?.disconnect(); }

  set hass(h) {
    this._hass = h;
    HASS_LANG = h.locale?.language || h.language || "en-GB";
    if (!this._entChecked && Object.keys(h.states || {}).length) { this._entChecked = true; checkEntities(h.states); this._showWarnings(); }
    const ring = h.states[OD.doorbell];
    if (ring) {
      if (this._lastRing === undefined) this._lastRing = ring.state;
      else if (ring.state !== this._lastRing) {
        this._lastRing = ring.state;
        if (ring.attributes.event_type === "ring" && this._built) this._doorbell();
      }
    }
    if (!this._built || this._dragging) return;
    const sig = this._signature();
    if (sig !== this._sig) { this._sig = sig; this._renderPage(false); }
  }
  set panel(p) {
    applyConfig(p?.config);
    this._entChecked = false;
    if (this._built) { this.steps = 0; this._build(); this._go(0); this._fit(); }
  }
  set narrow(_n) {}
  set route(_r) {}

  /* ---------- helpers ---------- */
  _showWarnings() {
    const el = this.shadowRoot.getElementById("cfgwarn");
    if (el) el.innerHTML = OD.showWarnings && WARNINGS.length ? WARNINGS.slice(-4).map((w) => "⚠ " + esc(w)).join("<br>") : "";
  }
  _st(id) { return this._hass?.states?.[id]; }
  _name(id) { const s = this._st(id); return s?.attributes?.friendly_name || titleCase(id.split(".")[1]); }
  _call(domain, service, data) { return this._hass?.callService(domain, service, data); }
  get _idx() { return ((this.steps % PAGES.length) + PAGES.length) % PAGES.length; }
  get _page() { return PAGES[this._idx]; }
  _lights() {
    return Object.keys(this._hass?.states || {}).filter((i) => i.startsWith("light.") && !OD.hiddenLights.includes(i)
      && this._st(i).state !== "unavailable");
  }
  _scenes() { return Object.keys(this._hass?.states || {}).filter((i) => i.startsWith("scene.")); }
  _players() { return OD.mediaPlayers.filter((i) => this._st(i)); }
  _signature() {
    const h = this._hass; if (!h) return "";
    const p = this._page.id;
    let ids = [];
    if (p === "home") ids = [OD.weather, ...OD.people, ...this._lights()];
    else if (p === "lights") ids = this._lights();
    else if (p === "media") ids = [...this._players(), OD.nowPlaying];
    else if (p === "vacuum") ids = [OD.vacuum.id, OD.vacuum.battery, OD.vacuum.water];
    else return p;
    return p + "|" + ids.map((i) => { const s = h.states[i]; return s ? s.state + (s.attributes.brightness ?? "") + (s.attributes.media_title ?? "") + (s.attributes.volume_level ?? "") + (s.attributes.temperature ?? "") + (s.attributes.fan_speed ?? "") : "x"; }).join(",");
  }

  /* ---------- shell ---------- */
  _build() {
    const stars = Array.from({ length: OD.theme.stars }, () => {
      const a = Math.random() * 6.283, r = 80 + Math.random() * (OD.shape === "square" ? 680 : 460);
      return `<circle cx="${(540 + Math.cos(a) * r).toFixed(1)}" cy="${(540 + Math.sin(a) * r).toFixed(1)}" r="${(Math.random() * 1.6 + .4).toFixed(1)}" fill="#fff" opacity="${(Math.random() * .5 + .15).toFixed(2)}"/>`;
    }).join("");
    // three zig-zag lines, each drawn as stacked strokes so the edges are soft (no blur filter).
    // Drawn with mix-blend-mode:darken in about the background colour: bright stars are pulled down to it, the dark background is left as it is.
    const zz = [430, 800, 1170].map((y0) => {
      const pts = Array.from({ length: 11 }, (_, i) => `${i * 160},${y0 + (i % 2 ? 70 : -70)}`).join(" ");
      return [[58, .15], [38, .35], [20, .9]].map(([w, o]) => `<polyline points="${pts}" fill="none" stroke="${esc(OD.theme.zigzag)}" stroke-opacity="${o}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`).join("");
    }).join("");
    const nodes = PAGES.map((p, i) => `
      <div class="node" data-i="${i}" style="--nc:${esc(p.accent)};transform:rotate(${i * STEP}deg) translateY(-${OD.ringRadius}px)">
        <div class="in"><button data-act="nav" data-i="${i}" aria-label="${esc(p.label)}">
          <svg viewBox="0 0 24 24">${p.icon}</svg><span>${p.label}</span></button></div>
      </div>`).join("");
    const T = OD.theme, hs = this.style;
    hs.setProperty("--od-font", T.font); hs.setProperty("--od-text", T.text); hs.setProperty("--od-muted", T.muted); hs.setProperty("--od-page", T.page ?? (OD.shape === "square" ? T.bg[2] : "#000")); hs.setProperty("--od-radius", OD.shape === "square" ? "0" : "50%");
    // square: the gradient reaches the page colour at the stage edge, so there is no seam
    hs.setProperty("--od-s2", OD.shape === "square" ? "30%" : "55%"); hs.setProperty("--od-s3", OD.shape === "square" ? "52%" : "100%");
    T.bg.forEach((c, i) => hs.setProperty(`--od-bg${i + 1}`, c));
    this.shadowRoot.innerHTML = `<style>${CSS}</style>
      <div class="stage" id="stage">
        <div class="stars"><svg viewBox="0 0 1080 1080">${stars}</svg></div>
        ${OD.zigzag.on ? `<div class="zz" style="animation-duration:${OD.zigzag.seconds}s"><svg viewBox="0 0 1600 1600">${zz}</svg></div>` : ""}
        <div class="orbits"><svg viewBox="0 0 1080 1080">
          <circle cx="540" cy="540" r="${OD.ringRadius}" fill="none" stroke="rgba(150,180,255,.18)" stroke-width="1.5"/>
          <g class="spin"><circle cx="540" cy="540" r="${OD.ringRadius - 66}" fill="none" stroke="rgba(150,180,255,.10)" stroke-width="1.5" stroke-dasharray="3 14"/>
          <circle cx="540" cy="${540 - OD.ringRadius + 66}" r="5" fill="var(--accent)"/></g></svg></div>
        <div class="glow"></div>
        <div class="marker"></div>
        <div class="cfgwarn" id="cfgwarn"></div>
        <div class="ring" id="ring">${nodes}</div>
        <div class="disc"><div id="content" style="display:contents"></div></div>
        <div class="idle" id="idle"><div class="idle-in">${this._idleArt()}
          <div class="fc" id="fc"><div class="ct" id="ict"></div><div class="cd" id="icd"></div></div></div></div>
        <div class="bell" id="bell">
          <div class="bell-ic"><svg viewBox="0 0 24 24"><path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15zM10 21h4"/></svg></div>
          <h2>${tx("bell_title")}</h2><div class="sub" id="bellTime"></div>
          <button class="chip bbtn primary" id="bellOpen" data-act="bell-open">${tx("bell_open")}</button>
          <button class="chip bbtn" data-act="bell-dismiss">${tx("bell_dismiss")}</button>
        </div>
      </div>`;
    const root = this.shadowRoot;
    this._showWarnings();
    root.getElementById("idle").addEventListener("pointerdown", (e) => { e.stopPropagation(); this._lastTouch = Date.now(); this._setIdle(false); });
    root.addEventListener("click", (e) => this._onClick(e));
    const stage = root.getElementById("stage");
    let sx = null;
    stage.addEventListener("pointerdown", (e) => { this._lastTouch = Date.now(); this._ripple(e); sx =e.target.closest("[data-noswipe]") ? null : e.clientX; });
    stage.addEventListener("pointercancel", () => this._release());
    stage.addEventListener("pointerup", (e) => {
      this._release();
      if (sx !== null && !this._dragging) {
        const dx = (e.clientX - sx) / (this._k || 1);
        if (Math.abs(dx) > 90) this._go(dx < 0 ? 1 : -1);
      }
      sx = null;
    });
  }

  // Press feedback is driven from pointer events, not :active (Chromium delays :active on touch, so quick taps never showed it).
  _release() {
    const el = this._pressed; if (!el) return;
    this._pressed = null;
    setTimeout(() => el.classList.remove("pressed"), Math.max(0, 140 - (Date.now() - this._pressedAt)));
  }

  _ripple(e) {
    const t = e.target.closest("button, .mid");
    if (!t || t.disabled || e.target.closest("[data-noripple]")) return;
    this._release();
    t.classList.add("pressed"); this._pressed = t; this._pressedAt = Date.now();
    if (t.closest(".node")) {
      t.classList.add("pulse"); setTimeout(() => t.classList.remove("pulse"), 700);
      return;
    }
    const r = t.getBoundingClientRect(), k = this._k || 1, size = Math.max(t.offsetWidth, t.offsetHeight) * 1.6;
    const s = document.createElement("span");
    s.className = "ripple";
    s.style.cssText = `width:${size}px;height:${size}px;left:${(e.clientX - r.left) / k}px;top:${(e.clientY - r.top) / k}px`;
    t.appendChild(s);
    setTimeout(() => s.remove(), 600);
  }

  _fit() { this._k = Math.min(this.clientWidth, this.clientHeight) / OD.size; this.shadowRoot.getElementById("stage").style.setProperty("--k", this._k); }

  _go(delta) {
    this.steps += delta;
    const idx = this._idx, root = this.shadowRoot;
    root.getElementById("ring").style.transform = `rotate(${-this.steps * STEP}deg)`;
    root.querySelectorAll(".node").forEach((n) => {
      const i = +n.dataset.i;
      n.querySelector(".in").style.transform = `rotate(${this.steps * STEP - i * STEP}deg)`;
      n.classList.toggle("active", i === idx);
    });
    root.getElementById("stage").style.setProperty("--accent", PAGES[idx].accent);
    this._sig = this._signature();
    this.sel.vacView = null; this.sel.wxHourly = false;
    this._renderPage(true);
  }

  _goTo(target) {
    let delta = target - this._idx;
    if (delta > PAGES.length / 2) delta -= PAGES.length;
    if (delta < -PAGES.length / 2) delta += PAGES.length;
    if (delta) this._go(delta);
  }

  _onClick(e) {
    this._lastTouch = Date.now();
    const t = e.target.closest("[data-act]"); if (!t) return;
    const a = t.dataset.act;
    // Pickers and tick-boxes redraw the page, which would wipe the press feedback: let it play first.
    if (["light-pick", "scene-room", "player-pick", "todo-done", "fav", "fav-open", "fav-close", "vac-fan", "vac-water", "vac-view", "vac-area", "vac-clean", "wx-toggle"].includes(a)) { setTimeout(() => this._act(t), 130); return; }
    if (!["nav", "scene"].includes(a)) { t.classList.add("bump"); setTimeout(() => t.classList.remove("bump"), 340); }
    this._act(t);
  }

  _act(t) {
    const a = t.dataset.act, d = t.dataset;
    if (a === "nav") this._goTo(+d.i);
    else if (a === "bell-open") this._bellOpen();
    else if (a === "bell-dismiss") this._hideBell();
    else if (a === "light-pick") { this.sel.light = d.id; this._renderPage(false); }
    else if (a === "light-toggle") { this._call("light", "toggle", { entity_id: d.id }); }
    else if (a === "wx-toggle") this._wxToggle();
    else if (a === "all-off") { this._call("light", "turn_off", { entity_id: this._lights() }); }
    else if (a === "scene-room") { this.sel.sceneRoom = d.room; this._renderPage(false); }
    else if (a === "scene") {
      this._call("scene", "turn_on", { entity_id: d.id });
      t.classList.add("fired"); setTimeout(() => t.classList.remove("fired"), 450);
    } else if (a === "player-pick") { this.sel.player = d.id; this.sel.favOpen = false; this._renderPage(false); }
    else if (a === "fav-open" || a === "fav-close") { this.sel.favOpen = a === "fav-open"; this._renderPage(false); }
    else if (a === "fav") {
      const f = OD.favourites[+d.i];
      this._starting = { ...this._starting, [d.id]: Date.now() };
      this.sel.favOpen = false;
      this._renderPage(false);
      Promise.resolve(this._call("media_player", "play_media", {
        entity_id: d.id, media_content_id: f.url, media_content_type: f.type,
        extra: { metadata: { metadataType: 3, title: f.name, artist: f.sub || tx("media_radio"), images: [{ url: OD.publicUrl + OD.logoPath + f.logo }] } },
      }))
        .catch(() => { delete this._starting[d.id]; this._renderPage(false); this._note(`Couldn't start ${f.name}`); });
      setTimeout(() => { if (this._page.id === "media") this._renderPage(false); }, 15500);
    }
    else if (a === "vac") { this._call("vacuum", d.svc, { entity_id: OD.vacuum.id }); }
    else if (a === "vac-fan") { this._call("vacuum", "set_fan_speed", { entity_id: OD.vacuum.id, fan_speed: d.v }); }
    else if (a === "vac-view") { this.sel.vacView = d.v || null; this._renderPage(false); }
    else if (a === "vac-area") {
      const cur = this.sel.vacAreas || [];
      this.sel.vacAreas = cur.includes(d.id) ? cur.filter((x) => x !== d.id) : [...cur, d.id];
      this._renderPage(false);
    }
    else if (a === "vac-clean") {
      const areas = this.sel.vacAreas || [];
      if (areas.length) {
        Promise.resolve(this._call("vacuum", "clean_area", { entity_id: OD.vacuum.id, cleaning_area_id: areas }))
          .catch(() => this._vacToast(tx("vac_fail"), true));
        this._vacToast(tx("vac_starting", { n: areas.length }));
      }
      this.sel.vacAreas = []; this.sel.vacView = null; this._renderPage(false);
    }
    else if (a === "vac-water") { this._call("select", "select_option", { entity_id: OD.vacuum.water, option: d.v }); }
    else if (a === "mp") { this._call("media_player", d.svc, { entity_id: d.id }); }
    else if (a === "todo-done") {
      this._call("todo", "update_item", { entity_id: OD.todo, item: d.item, status: "completed" });
      this._agenda.todos = this._agenda.todos.filter((x) => x.uid !== d.item);
      this._renderPage(false);
    }
  }

  _note(text) {
    const el = this.shadowRoot.getElementById("msub"); if (!el) return;
    el.textContent = text;
    setTimeout(() => { if (this._page.id === "media") this._renderPage(false); }, 4000);
  }

  _doorbell() {
    const r = this.shadowRoot, lock = this._st(OD.doorLock);
    this._lastTouch = Date.now();
    this._setIdle(false);
    this._bellArmed = false;
    clearTimeout(this._armT);
    const open = r.getElementById("bellOpen");
    open.textContent = tx("bell_open");
    open.style.display = lock && lock.state !== "unavailable" ? "" : "none";
    r.getElementById("bellTime").innerHTML = fmtTimeHtml(new Date());
    r.getElementById("bell").classList.add("on");
    clearTimeout(this._bellT);
    this._bellT = setTimeout(() => this._hideBell(), OD.bellShowMs);
  }

  _hideBell() {
    clearTimeout(this._bellT); clearTimeout(this._armT);
    this.shadowRoot.getElementById("bell").classList.remove("on");
    this._lastTouch = Date.now();
  }

  // Opening a door is a real-world action: first tap arms the button, a second tap within 4 s unlocks.
  _bellOpen() {
    const open = this.shadowRoot.getElementById("bellOpen");
    if (!this._bellArmed) {
      this._bellArmed = true;
      open.textContent = tx("bell_confirm");
      this._armT = setTimeout(() => { this._bellArmed = false; open.textContent = tx("bell_open"); }, 4000);
    } else {
      clearTimeout(this._armT); this._bellArmed = false;
      this._call("lock", "unlock", { entity_id: OD.doorLock });
      open.textContent = tx("bell_opening");
      setTimeout(() => this._hideBell(), 1500);
    }
  }

  _idleCheck() {
    const quiet = Date.now() - this._lastTouch;
    if (this._idx !== 0 && quiet > OD.idleReturnMs && !this._dragging) this._goTo(0);
    const lux = this._lux(), A = OD.ambient;
    if (lux === null) this._dark = true; // no reading: behave as before
    else if (lux <= A.idleLux) this._dark = true;
    else if (lux >= A.wakeLux) this._dark = false;
    const SS = OD.screensaver, wake = this._cond(SS.wakeWhen), start = this._cond(SS.startWhen);
    if (SS.enabled !== false && !this._idle && quiet > this._ssAfterMs() && !this._dragging && this._dark && start !== false) this._setIdle(true);
    if (this._idle && lux !== null && !this._dark) { this._lastTouch = Date.now(); this._setIdle(false); } // lights came on
    if (this._idle && wake === true) { this._lastTouch = Date.now(); this._setIdle(false); }
    if (this._idle) this._tickIdle();
  }

  _ssAfterMs() { const m = OD.screensaver.afterMinutes; return typeof m === "number" ? m * 60000 : OD.idleAfterMs; }
  _ssMode() { return OD.screensaver.mode || OD.idleMode; }

  // Evaluate { entity, state | above | below | changed }: true / false, or null when there is no condition or no usable reading
  _cond(c) {
    if (!c || !c.entity) return null;
    const st = this._st(c.entity), s = st?.state;
    this._seen = this._seen || {};
    const prev = this._seen[c.entity]; this._seen[c.entity] = s;
    if (s === undefined || s === "unavailable" || s === "unknown") return null;
    const num = parseFloat(s);
    if (c.changed && !(prev !== undefined && prev !== s)) return false;
    if (c.state !== undefined && !(Array.isArray(c.state) ? c.state : [c.state]).map(String).includes(s)) return false;
    if (c.above !== undefined && !(num > c.above)) return false;
    if (c.below !== undefined && !(num < c.below)) return false;
    return true;
  }

  _lux() {
    const v = parseFloat(this._st(OD.ambient.entity)?.state);
    return Number.isFinite(v) ? v : null;
  }

  // Backlight % wanted right now: fixed while the screensaver runs, otherwise follows the room light
  _targetBacklight() {
    if (this._idle) return OD.idleBacklight;
    const A = OD.ambient, lux = this._lux();
    if (lux === null) return OD.activeBacklight;
    const t = Math.max(0, Math.min(1, Math.log(Math.max(lux, A.darkLux) / A.darkLux) / Math.log(A.brightLux / A.darkLux)));
    return Math.round(A.minBacklight + t * (OD.activeBacklight - A.minBacklight));
  }

  // Eases toward the target (at most 4 % a second) so the screen never jumps; jump = true sets it at once
  _stepBacklight(jump) {
    const tgt = this._targetBacklight();
    this._bl = this._bl === undefined || jump ? tgt : this._bl + Math.max(-4, Math.min(4, tgt - this._bl));
    if (this._bl !== this._blSent) { this._blSent = this._bl; this._backlight(this._bl); }
  }

  // Fire-and-forget: the listener only exists on the Pi's own screen, other browsers just fail silently
  _backlight(pct) {
    if (!OD.backlightUrl) return;
    fetch(`${OD.backlightUrl}?pct=${pct}`, { mode: "no-cors" }).catch(() => {});
  }

  _setIdle(on) {
    this._idle = on;
    this._stepBacklight(true);
    this.shadowRoot.getElementById("idle").classList.toggle("on", on);
    if (on) { this._goTo(0); this._tickIdle(); }
  }

  // Ambient mode: nothing stays on the same pixels. The clock drifts on a slow Lissajous path,
  // the accent colour follows the time of day, and (nightsky) a shooting star crosses now and then.
  _tickIdle() {
    const r = this.shadowRoot, now = new Date(), t = now.getTime() / 1000;
    r.getElementById("ict").innerHTML = fmtTimeHtml(now);
    r.getElementById("icd").textContent = fmtDate(now);
    const fc = r.getElementById("fc");
    fc.style.transform = `translate(calc(-50% + ${(150 * Math.sin((2 * Math.PI * t) / 413)).toFixed(1)}px), calc(-50% + ${(110 * Math.sin((2 * Math.PI * t) / 307 + 1)).toFixed(1)}px))`;
    const h = now.getHours();
    const pal = h >= 6 && h < 12 ? ["#5ef0ff", "#6ea8ff"] : h >= 12 && h < 18 ? ["#6ea8ff", "#a78bfa"] : h >= 18 && h < 23 ? ["#ffb454", "#ff6b9a"] : ["#a78bfa", "#6ea8ff"];
    r.getElementById("ict").style.color = pal[Math.floor(t / 300) % pal.length];
    if (this._ssMode() === "nightsky" && Math.random() < 1 / 70) this._shoot();
  }

  _shoot() {
    const g = this.shadowRoot.getElementById("shoots"); if (!g) return;
    const x = 120 + Math.random() * 500, y = 120 + Math.random() * 400;
    g.insertAdjacentHTML("beforeend", `<line class="shoot" x1="${x}" y1="${y}" x2="${x - 70}" y2="${y - 38}"/>`);
    setTimeout(() => g.firstElementChild?.remove(), 1600);
  }

  _idleArt() {
    const rnd = (a, b) => a + Math.random() * (b - a);
    const star = (x, y, r) => `<circle class="tw" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="#fff" style="animation-duration:${rnd(4, 11).toFixed(1)}s;animation-delay:-${rnd(0, 10).toFixed(1)}s"/>`;
    const field = (n, rMin, rMax) => Array.from({ length: n }, () => { const a = rnd(0, 6.283), r = rnd(rMin, rMax); return star(540 + Math.cos(a) * r, 540 + Math.sin(a) * r, rnd(.5, 1.7)); }).join("");
    if (this._ssMode() === "nightsky") {
      const C = [ // [points], [line index pairs]; coordinates relative to screen centre
        { p: [[-250, -330], [-170, -300], [-90, -270], [-20, -230], [-10, -130], [110, -120], [130, -220]], l: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]] },
        { p: [[-330, 140], [-260, 220], [-180, 150], [-110, 240], [-30, 170]], l: [[0, 1], [1, 2], [2, 3], [3, 4]] },
        { p: [[160, 240], [200, 233], [240, 226], [130, 150], [270, 140], [120, 340], [280, 330]], l: [[0, 1], [1, 2], [3, 0], [4, 2], [3, 5], [4, 6], [3, 4]] },
        { p: [[230, -280], [300, -200], [250, -120], [330, -300]], l: [[0, 1], [1, 2], [0, 3]] },
      ];
      const art = C.map((c) => c.l.map(([a, b]) => `<line x1="${540 + c.p[a][0]}" y1="${540 + c.p[a][1]}" x2="${540 + c.p[b][0]}" y2="${540 + c.p[b][1]}" stroke="rgba(150,185,255,.4)" stroke-width="1.3"/>`).join("")
        + c.p.map(([x, y]) => `<circle cx="${540 + x}" cy="${540 + y}" r="4.5" fill="#dfe9ff" style="filter:drop-shadow(0 0 6px #9db8ff)"/>`).join("")).join("");
      return `<svg viewBox="0 0 1080 1080"><g class="sky">${field(150, 40, 520)}${art}</g><g id="shoots"></g></svg>`;
    }
    const planets = PAGES.map((p, i) => `<div class="pl" style="--a:${i * STEP};--c:${p.accent}"><i><svg viewBox="0 0 24 24">${p.icon}</svg></i></div>`).join("");
    return `<svg viewBox="0 0 1080 1080">${field(90, 60, 530)}</svg>
      <svg viewBox="0 0 1080 1080"><circle cx="540" cy="540" r="468" fill="none" stroke="rgba(150,180,255,.14)" stroke-width="1.5"/></svg>
      <div class="orb2"><svg viewBox="0 0 1080 1080"><circle cx="540" cy="540" r="396" fill="none" stroke="rgba(150,180,255,.12)" stroke-width="1.5" stroke-dasharray="3 14"/>
        <circle cx="540" cy="144" r="5" fill="#5ef0ff"/><circle cx="540" cy="936" r="4" fill="#ff6b9a"/></svg></div>
      <div class="orb">${planets}</div>`;
  }

  _tickClock() {
    const c = this.shadowRoot.getElementById("clock"), d = this.shadowRoot.getElementById("date");
    if (!c) return;
    const now = new Date();
    c.innerHTML = fmtTimeHtml(now);
    d.textContent = fmtDate(now);
  }

  /* ---------- pages ---------- */
  _renderPage(animate) {
    if (!this._hass) return;
    const el = this.shadowRoot.getElementById("content");
    const id = this._page.id;
    el.innerHTML = this["_p_" + id]();
    if (!animate && el.firstElementChild) el.firstElementChild.style.animation = "none";
    if (id === "home") this._tickClock();
    if (id === "lights") { this._bindDial(); this._bindHue(); }
    if (id === "media") { this._bindVolume(); this._marquee(); }
    if (id === "agenda" && Date.now() - this._agenda.at > 120000) this._loadAgenda();
  }

  // Short confirmation line on the Clean page (the vacuum takes a few seconds to change state)
  _vacToast(text, bad) {
    this.sel.vacToast = { text, bad };
    clearTimeout(this._vacToastT);
    this._vacToastT = setTimeout(() => { this.sel.vacToast = null; if (this._page.id === "vacuum" && !this.sel.vacView) this._renderPage(false); }, 6000);
  }

  // Tap the weather on Home to swap it for the next hours; it flips back by itself
  async _wxLoad() {
    if (this._wx && Date.now() - this._wx.at < 10 * 60000) return true;
    const id = OD.weather;
    try {
      const r = await this._hass.callWS({ type: "call_service", domain: "weather", service: "get_forecasts", service_data: { type: "hourly" }, target: { entity_id: id }, return_response: true });
      this._wx = { at: Date.now(), list: r.response?.[id]?.forecast || [] };
      return this._wx.list.length > 0;
    } catch (_) { return false; }
  }
  async _wxToggle() {
    clearTimeout(this._wxT);
    if (this.sel.wxHourly) { this.sel.wxHourly = false; this._renderPage(false); return; }
    const ok = await this._wxLoad();
    this.sel.wxHourly = true; this.sel.wxFail = !ok;
    this._renderPage(false);
    this._wxT = setTimeout(() => { this.sel.wxHourly = false; if (this._page.id === "home") this._renderPage(false); }, ok ? OD.hourlyShowMs : 4000);
  }

  _empty(title, hint) { return `<div class="page nostate"><b>${esc(title)}</b><span>${esc(hint)}</span></div>`; }

  _p_home() {
    const w = this._st(OD.weather);
    const temp = w ? `${Math.round(w.attributes.temperature)}${w.attributes.temperature_unit || "°C"}` : "";
    const people = OD.people.filter((i) => this._st(i)).map((i) => {
      const home = this._st(i).state === "home";
      return `<div class="ini ${home ? "ok" : ""}" title="${esc(this._name(i))}">${esc(this._name(i).trim().charAt(0).toUpperCase())}</div>`;
    }).join("");
    // the Hue Room group (defaultLight) controls the others, so it is not counted as a light of its own
    const lon = this._lights().filter((i) => i !== OD.defaultLight && this._st(i).state === "on").length;
    const li = PAGES.findIndex((p) => p.id === "lights"); // the chip jumps to the Lights page when it is in the ring
    let hours = "";
    if (this.sel.wxHourly) {
      const next = (this._wx?.list || []).filter((f) => new Date(f.datetime) > new Date()).slice(0, 5);
      hours = next.length && !this.sel.wxFail ? `<button class="h-hours" data-act="wx-toggle" aria-label="${esc(tx("back_to_weather"))}">${next.map((f) =>
        `<span class="hr"><i>${esc(fmtTime(new Date(f.datetime)))}</i><svg viewBox="0 0 24 24">${WX_ICON[f.condition] || WX_ICON.cloudy}</svg><b>${Math.round(f.temperature)}°</b></span>`).join("")}</button>`
        : `<button class="h-weather" data-act="wx-toggle"><span class="dim">${esc(tx("forecast_unavailable"))}</span></button>`;
    }
    const wxIcon = w ? `<svg viewBox="0 0 24 24">${WX_ICON[w.state] || WX_ICON.cloudy}</svg>` : "";
    return `<div class="page home" style="gap:10px">
      ${w ? `<div class="h-above">${this.sel.wxHourly ? hours : `<button class="h-weather" data-act="wx-toggle" aria-label="${esc(tx("hourly_aria"))}"><b>${esc(temp)}</b><div class="wx">${wxIcon}<span class="dim">${esc(hasLabel("wx_" + w.state.replace(/-/g, "_")) ? tx("wx_" + w.state.replace(/-/g, "_")) : titleCase(w.state))}</span></div></button>`}</div>` : ""}
      <div class="h-time" id="clock"></div>
      <div class="h-below"><div class="h-date" id="date"></div>
      <div class="chips" style="margin-top:12px"><button class="chip ${lon ? "on" : ""}" data-act="${lon ? "all-off" : li >= 0 ? "nav" : ""}" data-i="${li}"><span class="dot ${lon ? "warn" : ""}"></span>${lon ? tx("lights_on", { n: lon }) : tx("lights_off")}</button></div></div>
    </div>${people ? `<div class="people">${people}</div>` : ""}`;
  }

  _p_lights() {
    const ids = this._lights();
    if (!ids.length) return this._empty(tx("no_lights"), tx("no_lights_hint"));
    if (!ids.includes(this.sel.light)) this.sel.light = ids.includes(OD.defaultLight) ? OD.defaultLight : ids[0];
    const id = this.sel.light, s = this._st(id), on = s.state === "on";
    const pct = on ? Math.round(((s.attributes.brightness ?? 255) / 255) * 100) : 0;
    this._dialPct = pct;
    const modes = s.attributes.supported_color_modes || [];
    const canK = modes.includes("color_temp"), canC = modes.some((m) => ["hs", "xy", "rgb", "rgbw", "rgbww"].includes(m));
    // whites take a quarter of the bar when the light also does colour
    const w = canK && canC ? 0.24 : canK ? 1 : 0, at = s.attributes;
    this._hueW = w;
    let pos = 0;
    if (at.color_mode === "color_temp" && at.color_temp_kelvin && w) pos = w * ((at.color_temp_kelvin - K_MIN) / (K_MAX - K_MIN));
    else if (at.hs_color && w < 1) pos = w + (1 - w) * (at.hs_color[0] / 360);
    pos = Math.max(0, Math.min(1, pos));
    const hue = canK || canC ? `<input type="range" class="hue" id="hue" min="0" max="1000" value="${Math.round(pos * 1000)}" data-noswipe style="--bar:${hueBar(w)};--tc:${hueAt(pos, w).css}">` : "";
    const chips = ids.map((i) => `<button class="chip ${i === id ? "on" : ""}" data-act="light-pick" data-id="${esc(i)}">${esc(this._name(i))}</button>`).join("");
    return `<div class="page" style="gap:14px"><div class="chips" data-noswipe>${chips}</div>
      <div class="dial" id="dial" data-noswipe>
        <svg viewBox="0 0 400 400"><path id="track" fill="none" stroke="rgba(160,190,255,.16)" stroke-width="26" stroke-linecap="round"/>
          <path id="val" fill="none" stroke="var(--accent)" stroke-width="26" stroke-linecap="round" style="filter:drop-shadow(0 0 10px var(--accent))"/>
          <circle id="knob" r="22" fill="#fff" style="filter:drop-shadow(0 0 8px var(--accent))"/></svg>
        <div class="mid ${on ? "on" : ""}" data-act="light-toggle" data-id="${esc(id)}">
          <div class="pct" id="pct">${pct}<small>%</small></div><div class="nm">${esc(this._name(id))}</div>
          <div class="pwr"><svg viewBox="0 0 24 24"><path d="M12 3v8M6.3 6.8a8 8 0 1 0 11.4 0"/></svg></div></div>
      </div>
      ${hue}</div>`;
  }

  _bindHue() {
    const inp = this.shadowRoot.getElementById("hue"); if (!inp) return;
    const id = this.sel.light, w = this._hueW; let last = 0;
    const apply = (final) => {
      const c = hueAt(inp.value / 1000, w);
      inp.style.setProperty("--tc", c.css);
      if (final || Date.now() - last > 150) { last = Date.now(); this._call("light", "turn_on", { entity_id: id, ...c.data }); }
    };
    inp.addEventListener("pointerdown", () => { this._dragging = true; });
    inp.addEventListener("input", () => apply(false));
    inp.addEventListener("change", () => { this._dragging = false; apply(true); this._sig = ""; });
  }

  _arc(p) {
    const pt = (deg) => [200 + 170 * Math.cos((deg * Math.PI) / 180), 200 + 170 * Math.sin((deg * Math.PI) / 180)];
    const end = 135 + 270 * p, [x0, y0] = pt(135), [x1, y1] = pt(end);
    return { d: `M${x0} ${y0} A170 170 0 ${270 * p > 180 ? 1 : 0} 1 ${x1} ${y1}`, x: x1, y: y1 };
  }
  _paintDial(p) {
    const r = this.shadowRoot, a = this._arc(Math.max(p, 0.001)), full = this._arc(0.9999);
    r.getElementById("track").setAttribute("d", full.d);
    r.getElementById("val").setAttribute("d", a.d);
    r.getElementById("val").style.opacity = p > 0 ? 1 : 0;
    r.getElementById("knob").setAttribute("cx", a.x); r.getElementById("knob").setAttribute("cy", a.y);
    r.getElementById("pct").innerHTML = `${Math.round(p * 100)}<small>%</small>`;
  }
  _bindDial() {
    const dial = this.shadowRoot.getElementById("dial"); if (!dial) return;
    this._paintDial(this._dialPct / 100);
    const id = this.sel.light;
    let last = 0;
    const calc = (e) => {
      const r = dial.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      let rel = ((Math.atan2(dy, dx) * 180) / Math.PI - 135 + 360) % 360;
      if (rel > 270) rel = rel > 315 ? 0 : 270;
      return rel / 270;
    };
    const send = (p) => this._call("light", "turn_on", { entity_id: id, brightness_pct: Math.max(1, Math.round(p * 100)) });
    dial.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".mid")) return; // centre = toggle
      this._dragging = true; dial.setPointerCapture(e.pointerId);
      const p = calc(e); this._paintDial(p); send(p); last = Date.now();
    });
    dial.addEventListener("pointermove", (e) => {
      if (!this._dragging) return;
      const p = calc(e); this._paintDial(p);
      if (Date.now() - last > 120) { send(p); last = Date.now(); }
    });
    const end = (e) => { if (!this._dragging) return; this._dragging = false; send(calc(e)); this._sig = ""; };
    dial.addEventListener("pointerup", end); dial.addEventListener("pointercancel", end);
  }

  _p_scenes() {
    const order = OD.sceneRooms.map((r) => r[1]);
    const room = (i) => (OD.sceneRooms.find((r) => i.startsWith(r[0])) || [0, tx("scenes_group")])[1];
    const rank = (r) => (order.includes(r) ? order.indexOf(r) : order.length);
    const all = this._scenes(), rooms = [...new Set(all.map(room))].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
    if (!rooms.includes(this.sel.sceneRoom)) this.sel.sceneRoom = rooms[0] || "all";
    const list = all.filter((i) => room(i) === this.sel.sceneRoom);
    const seen = new Set();
    const btns = list.map((i) => [i, this._name(i)]).filter(([, n]) => !seen.has(n) && seen.add(n)).sort((a, b) => a[1].localeCompare(b[1]))
      .map(([i, n]) => `<button class="scene" data-act="scene" data-id="${esc(i)}">${esc(n)}</button>`).join("");
    return `<div class="page" style="gap:16px"><div class="chips" data-noswipe>${rooms.map((r) => `<button class="chip ${r === this.sel.sceneRoom ? "on" : ""}" data-act="scene-room" data-room="${esc(r)}">${esc(r)}</button>`).join("")}</div>
      <div class="scene-grid" data-noswipe>${btns || this._empty(tx("no_scenes"), tx("no_scenes_hint"))}</div></div>`;
  }

  _p_media() {
    const ids = this._players();
    if (!ids.length) return this._empty(tx("no_players"), tx("no_players_hint"));
    if (!ids.includes(this.sel.player)) this.sel.player = ids.find((i) => ["playing", "paused"].includes(this._st(i).state)) || ids[0];
    const id = this.sel.player, s = this._st(id), a = s.attributes, playing = s.state === "playing";
    // Cast devices only accept transport commands while a session is live, and only the ones they advertise.
    const live = ["playing", "paused", "buffering"].includes(s.state), sf = a.supported_features || 0;
    const can = { prev: live && sf & 16, pp: live && sf & (1 | 16384), next: live && sf & 32, vol: live && sf & 4 };
    const active = live;
    // Raw streams carry no track info, so HA only reports "Default Media Receiver": name the station from its URL instead.
    const station = live ? OD.favourites.find((f) => f.url === a.media_content_id) : null;
    const np = station && this._st(OD.nowPlaying), raw = np && np.attributes.url === station.url && !["unknown", "unavailable"].includes(np.state) ? np.state.trim() : "";
    let song = null; // "Artist - Title" or "Title - Artist" depending on the station
    if (raw) {
      const [x, ...rest] = raw.split(" - "), y = rest.join(" - ");
      song = !y ? { title: x, artist: "" } : station.order === "title-artist" ? { title: x, artist: y } : { title: y, artist: x };
    }
    const title = song ? song.title : station ? station.name : a.media_title || titleCase(s.state);
    const sub = song ? `${song.artist ? song.artist + " · " : ""}${station.name}` : station ? `${station.sub || tx("media_radio")} · ${tx("media_live")}` : a.media_artist || (a.app_name === "Default Media Receiver" ? "" : a.app_name) || "";
    const starting = !live && Date.now() - (this._starting?.[id] || 0) < 15000;
    const showFav = live ? !!this.sel.favOpen : !starting && OD.favourites.length > 0;
    const logo = station?.logo ? OD.logoPath + station.logo : "";
    const pic = logo || (a.entity_picture ? (this._hass.hassUrl ? this._hass.hassUrl(a.entity_picture) : a.entity_picture) : "");
    const vol = Math.round((a.volume_level ?? 0) * 100);
    const ic = {
      prev: '<path d="M6 5h2.5v14H6zM20 5v14L9.5 12z"/>', next: '<path d="M15.5 5H18v14h-2.5zM4 5v14l10.5-7z"/>',
      play: '<path d="M7 4.5v15l13-7.5z"/>', pause: '<path d="M6 4.5h4.5v15H6zM13.5 4.5H18v15h-4.5z"/>',
    };
    return `<div class="page" style="gap:14px"><div class="chips" data-noswipe style="max-width:440px">${ids.map((i) => `<button class="chip sm ${i === id ? "on" : ""}" data-act="player-pick" data-id="${esc(i)}">${esc(this._name(i))}</button>`).join("")}</div>
      <div class="art ${playing && !logo ? "playing" : ""} ${live ? "" : "small"} ${logo ? "logo" : ""}" style="${cssUrl(pic) ? `background-image:url('${esc(cssUrl(pic))}')` : ""}"></div>
      <div><div class="m-title">${esc(active ? title : starting ? tx("media_starting") : tx("media_nothing"))}</div>
      <div class="m-sub dim" id="msub">${esc(active ? sub : starting ? tx("media_starting_hint") : tx("media_pick"))}&nbsp;</div></div>
      ${showFav ? `<div class="favs" data-noswipe>${OD.favourites.map((f, i) => `<button class="fav" data-act="fav" data-i="${i}" data-id="${esc(id)}"><b>${esc(f.name)}</b><span>${esc(f.sub || "")}</span></button>`).join("")}</div>
        ${live ? `<button class="chip" data-act="fav-close" data-noswipe>${tx("media_back")}</button>` : ""}` : ""}
      ${live && !showFav ? `<div class="ctrls" data-noswipe>
        <button class="cb" ${can.prev ? "" : "disabled"} data-act="mp" data-svc="media_previous_track" data-id="${esc(id)}"><svg viewBox="0 0 24 24">${ic.prev}</svg></button>
        <button class="cb big" ${can.pp ? "" : "disabled"} data-act="mp" data-svc="media_play_pause" data-id="${esc(id)}"><svg viewBox="0 0 24 24">${playing ? ic.pause : ic.play}</svg></button>
        <button class="cb" ${can.next ? "" : "disabled"} data-act="mp" data-svc="media_next_track" data-id="${esc(id)}"><svg viewBox="0 0 24 24">${ic.next}</svg></button></div>
      ${can.vol ? `<input type="range" id="vol" min="0" max="100" value="${vol}" data-noswipe>` : ""}
      ${OD.favourites.length ? `<button class="chip" data-act="fav-open" data-noswipe>${tx("media_stations")}</button>` : ""}` : ""}</div>`;
  }
  // Long titles scroll slowly back and forth instead of ending in an ellipsis
  _marquee() {
    for (const el of this.shadowRoot.querySelectorAll(".m-title, .m-sub")) {
      if (el.scrollWidth <= el.clientWidth + 2) continue;
      el.innerHTML = `<span>${el.innerHTML}</span>`;
      el.style.setProperty("--mq", `${-(el.firstChild.offsetWidth - el.clientWidth + 6)}px`);
      el.classList.add("mq");
    }
  }
  _bindVolume() {
    const v = this.shadowRoot.getElementById("vol"); if (!v) return;
    const id = this.sel.player; let last = 0;
    v.addEventListener("pointerdown", () => { this._dragging = true; });
    v.addEventListener("input", () => { if (Date.now() - last > 150) { last = Date.now(); this._call("media_player", "volume_set", { entity_id: id, volume_level: v.value / 100 }); } });
    v.addEventListener("change", () => { this._dragging = false; this._call("media_player", "volume_set", { entity_id: id, volume_level: v.value / 100 }); });
  }

  _p_vacuum() {
    const V = OD.vacuum, v = this._st(V.id);
    if (!v) return this._empty(tx("vac_not_found"), tx("vac_not_found_hint"));
    const a = v.attributes, state = v.state, num = (id) => parseFloat(this._st(id)?.state);
    // Capabilities: HA's VacuumEntityFeature bits. Without a supported_features attribute everything is offered, as before.
    const sf = a.supported_features, can = (bit) => sf == null || (sf & bit) !== 0;
    const F = { TURN_ON: 1, TURN_OFF: 2, PAUSE: 4, STOP: 8, RETURN_HOME: 16, LOCATE: 512, START: 8192, CLEAN_AREA: 16384 };
    const startSvc = can(F.START) ? "start" : can(F.TURN_ON) ? "turn_on" : null;
    const pauseSvc = can(F.PAUSE) ? "pause" : can(F.STOP) ? "stop" : can(F.TURN_OFF) ? "turn_off" : null;
    const bat = Math.max(0, Math.min(100, Math.round(num(V.battery) || a.battery_level || 0)));
    const label = ["cleaning", "returning", "docked", "paused", "idle", "error", "unavailable"].includes(state) ? tx("vac_" + state) : titleCase(state);
    const cleaning = state === "cleaning", offline = state === "unavailable" || state === "unknown";
    const working = cleaning || state === "returning", ringCol = state === "error" ? "#ffb454" : "var(--accent)";
    const low = V.consumables.map(([n, id]) => [n, num(id)]).filter(([, p]) => p < V.lowPct).sort((x, y) => x[1] - y[1])[0];
    const area = num(V.area), dur = num(V.duration);
    const stat = working && !isNaN(dur) ? `${Math.round(dur)} ${tx("vac_min")}${isNaN(area) ? "" : ` · ${Math.round(area)} ${tx("vac_area")}`}`
      : !isNaN(area) && !isNaN(dur) ? `${tx("vac_last")}\n${Math.round(area)} ${tx("vac_area")} · ${Math.round(dur)} ${tx("vac_min")}` : "";
    // Battery is not interesting while she manages it herself: only mention it when it is actually low.
    const notes = [bat > 0 && bat <= 20 ? tx("vac_battery", { n: bat }) : "", low ? tx("vac_worn", { name: low[0], n: Math.round(low[1]) }) : ""].filter(Boolean);
    const fans = Array.isArray(a.fan_speed_list) ? a.fan_speed_list : [];
    const water = this._st(V.water), wopts = water?.attributes?.options || [];
    const short = { max_plus: "Max+", ultrahigh: "Ultra", medium: "Med" };
    const chipRow = (lbl, items, cur, act) => items.length ? `<div class="chips" data-noswipe><span class="dim lbl">${lbl}</span>${items.map((o) =>
      `<button class="chip sm ${o === cur ? "on" : ""}" data-act="${act}" data-v="${esc(o)}">${esc(short[o] || titleCase(o))}</button>`).join("")}</div>` : "";
    const back = `<button class="cb" aria-label="${esc(tx("back"))}" data-act="vac-view" data-v="" data-noswipe><svg viewBox="0 0 24 24"><path d="M14.5 5.5 8 12l6.5 6.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;
    if (this.sel.vacView === "options") {
      return `<div class="page" style="gap:18px"><div class="vsub">${esc(tx("vac_suction_water"))}</div>
        ${chipRow(esc(tx("vac_suction")), fans, a.fan_speed, "vac-fan")}${chipRow(esc(tx("vac_water")), wopts, water?.state, "vac-water")}
        <div class="ctrls" style="margin-top:8px" data-noswipe>${back}</div></div>`;
    }
    if (this.sel.vacView === "areas") {
      const picked = this.sel.vacAreas || [];
      // The map fits itself to the rooms: bounding box of the (rotated) shapes plus a margin
      const rot = [0, 90, -90, 180].includes(V.mapRotate) ? V.mapRotate : 0, cs = Math.round(Math.cos(rot * Math.PI / 180)), sn = Math.round(Math.sin(rot * Math.PI / 180));
      const pts = V.rooms.flatMap((r) => String(r.p).trim().split(/\s+/).map((q) => q.split(",").map(Number)).filter((q) => q.length === 2 && q.every(Number.isFinite)).map(([x, y]) => [x * cs - y * sn, x * sn + y * cs]));
      const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
      const view = V.mapView || (pts.length ? `${Math.min(...xs) - 20} ${Math.min(...ys) - 20} ${Math.max(...xs) - Math.min(...xs) + 40} ${Math.max(...ys) - Math.min(...ys) + 40}` : "0 0 100 100");
      const shapes = V.rooms.map((r) => `<polygon class="room${picked.includes(r.id) ? " on" : ""}" style="--c:${esc(r.c)}" points="${esc(r.p)}" data-act="vac-area" data-id="${esc(r.id)}"/>`).join("");
      const icons = V.rooms.map((r) => `<g class="ric" transform="translate(${r.l[0]} ${r.l[1]}) rotate(${-rot}) scale(${(r.s || 112) / 24}) translate(-12 -12)"><path d="${esc(r.i)}"/></g>`).join("");
      return `<div class="page" style="gap:18px"><div class="vsub">${esc(tx("vac_rooms"))}</div>
        <svg class="vmap" viewBox="${view}" style="--sw:${(+view.split(" ")[2] / 300).toFixed(2)}" data-noswipe data-noripple><g transform="rotate(${rot})">${shapes}${icons}</g></svg>
        <div class="ctrls" style="margin-top:4px" data-noswipe>${back}<button class="chip go" ${picked.length && !offline ? "" : "disabled"} data-act="vac-clean">${esc(tx("vac_clean"))}${picked.length ? ` (${picked.length})` : ""}</button></div></div>`;
    }
    return `<div class="page" style="gap:12px">
      <div class="vring${working ? " working" : ""}"><svg viewBox="-30 -30 300 300">
        <circle cx="120" cy="120" r="108" fill="none" stroke="rgba(160,190,255,.14)" stroke-width="12"/>
        <g style="opacity:${working ? 1 : state === "error" ? 1 : .35}">${[[40, .05], [30, .08], [21, .14], [12, 1]].map(([w, o]) =>
          `<circle class="vsweep" cx="120" cy="120" r="108" fill="none" stroke="${ringCol}" stroke-opacity="${o}" stroke-width="${w}" stroke-linecap="round"
          ${working ? 'stroke-dasharray="170 509"' : ""}/>`).join("")}</g></svg>
        <div class="vc"><div class="vlabel">${esc(label)}</div><div class="vstat dim">${esc(stat).replace(/\n/g, "<br>")}</div></div></div>
      ${this.sel.vacToast ? `<div class="vtoast ${this.sel.vacToast.bad ? "bad" : ""}">${esc(this.sel.vacToast.text)}</div>` : ""}
      ${notes.length && !this.sel.vacToast ? `<div class="vnote">${notes.map(esc).join(" · ")}</div>` : ""}
      <div class="ctrls" data-noswipe>
        ${can(F.RETURN_HOME) ? `<button class="chip" ${offline || ["docked", "returning"].includes(state) ? "disabled" : ""} data-act="vac" data-svc="return_to_base">${esc(tx("vac_dock"))}</button>` : ""}
        <button class="cb big" ${offline || !(cleaning ? pauseSvc : startSvc) ? "disabled" : ""} data-act="vac" data-svc="${cleaning ? pauseSvc : startSvc}"><svg viewBox="0 0 24 24">${cleaning ? '<path d="M6 4.5h4.5v15H6zM13.5 4.5H18v15h-4.5z"/>' : '<path d="M7 4.5v15l13-7.5z"/>'}</svg></button>
        ${can(F.LOCATE) ? `<button class="chip" ${offline ? "disabled" : ""} data-act="vac" data-svc="locate">${esc(tx("vac_locate"))}</button>` : ""}</div>
      <div class="chips" data-noswipe>
        ${V.rooms.length && can(F.CLEAN_AREA) ? `<button class="chip sm" ${offline || cleaning ? "disabled" : ""} data-act="vac-view" data-v="areas">${esc(tx("vac_by_room"))}</button>` : ""}
        ${fans.length || wopts.length ? `<button class="chip sm" ${offline ? "disabled" : ""} data-act="vac-view" data-v="options">${esc(tx("vac_suction_water"))}</button>` : ""}</div></div>`;
  }

  _p_agenda() {
    const A = this._agenda, today = new Date(); today.setHours(0, 0, 0, 0);
    const when = (ev) => {
      const allDay = !!ev.start.date, d = new Date(allDay ? ev.start.date + "T00:00" : ev.start.dateTime);
      const diff = Math.round((new Date(d).setHours(0, 0, 0, 0) - today) / 864e5);
      const day = diff === 0 ? tx("today") : diff === 1 ? tx("tomorrow") : fmtDate(d, { weekday: "short", day: "numeric" });
      return { day, time: allDay ? "" : fmtTime(d) };
    };
    const evs = A.events.slice(0, 3).map((e) => { const wh = when(e); return `<div class="row ev"><span class="t">${esc(e.summary)}</span><span class="w2"><b${wh.day === tx("today") ? ' class="now"' : ""}>${esc(wh.day)}</b>${wh.time ? `<i>${esc(wh.time)}</i>` : ""}</span></div>`; }).join("") || `<div class="row ph">${A.at ? tx("nothing_coming") : tx("loading")}</div>`;
    const iso = today.toLocaleDateString("sv");
    const due = (t) => {
      if (!t.due) return "";
      const diff = Math.round((new Date(t.due.slice(0, 10) + "T00:00") - today) / 864e5);
      return diff === 0 ? tx("today") : diff === -1 ? tx("yesterday") : tx("days_late", { n: -diff });
    };
    const todos = A.todos.slice(0, 3).map((t) => `<button class="row" data-act="todo-done" data-item="${esc(t.uid)}"><span class="cbx"></span><span class="t">${esc(t.summary)}</span><span class="w"${t.due && t.due.slice(0, 10) < iso ? ' style="color:#ff8a80"' : ""}>${esc(due(t))}</span></button>`).join("") || `<div class="row ph">${A.at ? tx("all_done") : tx("loading")}</div>`;
    return `<div class="page" style="gap:16px">
      <div class="sec"><div class="title">${esc(tx("next_up"))}${A.events.length > 3 ? ` · +${A.events.length - 3}` : ""}</div>${evs}</div>
      <div class="sec" data-noswipe><div class="title">${esc(tx("todo"))}${A.todos.length > 3 ? ` · +${A.todos.length - 3}` : ""}</div>${todos}</div>
      ${A.shoppingCount ? `<div class="dim" style="font-size:22px">${esc(tx("shopping", { n: A.shoppingCount }))}</div>` : ""}</div>`;
  }

  async _loadAgenda() {
    this._agenda.at = Date.now();
    const h = this._hass, start = new Date(), end = new Date(Date.now() + 14 * 864e5);
    try {
      const lists = await Promise.all(OD.calendars.filter((c) => h.states[c]).map((c) =>
        h.callApi("GET", `calendars/${c}?start=${start.toISOString()}&end=${end.toISOString()}`).catch(() => [])));
      const t = (e) => new Date(e.start.dateTime || e.start.date + "T00:00").getTime();
      this._agenda.events = lists.flat().filter((e) => new Date(e.end?.dateTime || e.end?.date || e.start.dateTime || e.start.date) > new Date()).sort((a, b) => t(a) - t(b));
    } catch (_) {}
    try {
      const get = (entity) => h.callWS({ type: "call_service", domain: "todo", service: "get_items", service_data: { entity_id: entity, status: "needs_action" }, return_response: true })
        .then((r) => r.response?.[entity]?.items || []).catch(() => []);
      const today = new Date().toLocaleDateString("sv");
      this._agenda.todos = (h.states[OD.todo] ? await get(OD.todo) : [])
        .filter((t) => !t.due || t.due.slice(0, 10) <= today)
        .sort((a, b) => (a.due || "").localeCompare(b.due || ""));
      this._agenda.shoppingCount = h.states[OD.shopping] ? (await get(OD.shopping)).length : 0;
    } catch (_) {}
    if (this._page.id === "agenda" && !this._dragging) this._renderPage(false);
  }
}

if (!customElements.get("orbital-dash")) customElements.define("orbital-dash", OrbitalDash);

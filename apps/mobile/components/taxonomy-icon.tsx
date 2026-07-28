import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useInfoKitTheme } from "@infokit/ui";

type Glyph = keyof typeof MaterialCommunityIcons.glyphMap;

/**
 * The catalogue's icon vocabulary, drawn on the phone.
 *
 * A row's `icon` is a Lucide name — that is what the editor picks and what the
 * web reader renders (apps/web/src/components/taxonomy-icon.tsx). The app has no
 * SVG icon set, so each name maps to the nearest glyph of the icon font it does
 * carry. Names are matched, never guessed at render time: an unmapped name gets
 * the neutral glyph below, which is safe because the label is always next to it
 * (docs/DESIGN-SYSTEM.md rule 1 — nothing is said by a picture alone).
 */
const taxonomyGlyphs: Record<string, Glyph> = {
  // Food & drink
  utensils: "silverware-fork-knife",
  "utensils-crossed": "silverware",
  "cooking-pot": "pot-steam-outline",
  soup: "bowl-mix-outline",
  sandwich: "food-outline",
  salad: "bowl-mix-outline",
  apple: "food-apple-outline",
  carrot: "carrot",
  egg: "egg-outline",
  fish: "fish",
  cake: "cake-variant-outline",
  cookie: "cookie-outline",
  candy: "candy-outline",
  pizza: "pizza",
  wheat: "barley",
  milk: "cup-water",
  coffee: "coffee-outline",
  "cup-soda": "cup-outline",
  "glass-water": "cup-water",
  wine: "glass-wine",
  beer: "beer-outline",
  droplet: "water-outline",
  droplets: "water",
  refrigerator: "fridge-outline",
  microwave: "microwave",
  // Hygiene & sanitation
  bath: "shower",
  "shower-head": "shower-head",
  shower: "shower",
  toilet: "toilet",
  "spray-can": "spray",
  trash: "trash-can-outline",
  "trash-2": "trash-can-outline",
  "brush-cleaning": "broom",
  hand: "hand-wash-outline",
  waves: "waves",
  wind: "weather-windy",
  // Clothing & belongings
  shirt: "tshirt-crew-outline",
  footprints: "shoe-print",
  backpack: "bag-personal-outline",
  luggage: "bag-suitcase-outline",
  "shopping-bag": "shopping-outline",
  "shopping-basket": "basket-outline",
  "shopping-cart": "cart-outline",
  glasses: "glasses",
  umbrella: "umbrella-outline",
  watch: "watch",
  scissors: "content-cut",
  // Shelter & housing
  tent: "tent",
  "tent-tree": "tent",
  house: "home-outline",
  bed: "bed-outline",
  "bed-double": "bed-king-outline",
  "bed-single": "bed-single-outline",
  building: "office-building-outline",
  "building-2": "office-building-outline",
  warehouse: "warehouse",
  hotel: "bed-outline",
  "door-open": "door-open",
  "door-closed": "door-closed",
  key: "key-outline",
  "key-round": "key-outline",
  lamp: "lamp",
  sofa: "sofa-outline",
  armchair: "seat-outline",
  landmark: "bank-outline",
  // Energy & weather
  flame: "fire",
  thermometer: "thermometer",
  "thermometer-snowflake": "snowflake-thermometer",
  snowflake: "snowflake",
  sun: "white-balance-sunny",
  moon: "weather-night",
  cloud: "weather-cloudy",
  "cloud-rain": "weather-rainy",
  "cloud-snow": "weather-snowy",
  zap: "flash-outline",
  plug: "power-plug-outline",
  battery: "battery-outline",
  "battery-charging": "battery-charging",
  lightbulb: "lightbulb-outline",
  fan: "fan",
  // Health & medical
  heart: "heart-outline",
  "heart-pulse": "heart-pulse",
  stethoscope: "stethoscope",
  pill: "pill",
  syringe: "needle",
  cross: "medical-bag",
  bandage: "bandage",
  ambulance: "ambulance",
  hospital: "hospital-building",
  accessibility: "wheelchair-accessibility",
  "hand-heart": "hand-heart-outline",
  brain: "brain",
  eye: "eye-outline",
  ear: "ear-hearing",
  // Legal & documents
  scale: "scale-balance",
  gavel: "gavel",
  file: "file-outline",
  "file-text": "file-document-outline",
  "file-check": "file-check-outline",
  folder: "folder-outline",
  clipboard: "clipboard-outline",
  "clipboard-list": "clipboard-list-outline",
  book: "book-outline",
  "book-open": "book-open-outline",
  notebook: "notebook-outline",
  pen: "pencil-outline",
  pencil: "pencil-outline",
  signature: "signature-freehand",
  "id-card": "card-account-details-outline",
  fingerprint: "fingerprint",
  stamp: "stamper",
  receipt: "receipt",
  "badge-check": "check-decagram-outline",
  // Information & orientation
  info: "information-outline",
  "circle-help": "help-circle-outline",
  megaphone: "bullhorn-outline",
  bell: "bell-outline",
  map: "map-outline",
  "map-pin": "map-marker-outline",
  "map-pinned": "map-marker-check-outline",
  compass: "compass-outline",
  signpost: "sign-direction",
  "signpost-big": "sign-direction",
  flag: "flag-outline",
  list: "format-list-bulleted",
  newspaper: "newspaper-variant-outline",
  // Communication & tech
  phone: "phone-outline",
  "phone-call": "phone-in-talk-outline",
  smartphone: "cellphone",
  tablet: "tablet",
  laptop: "laptop",
  monitor: "monitor",
  wifi: "wifi",
  "wifi-off": "wifi-off",
  globe: "earth",
  mail: "email-outline",
  "mail-open": "email-open-outline",
  send: "send-outline",
  "message-circle": "message-outline",
  "message-square": "message-text-outline",
  "at-sign": "at",
  radio: "radio",
  headphones: "headphones",
  mic: "microphone-outline",
  camera: "camera-outline",
  printer: "printer-outline",
  "qr-code": "qrcode",
  // Transport & mobility
  bus: "bus",
  car: "car",
  bike: "bike",
  "train-front": "train",
  "tram-front": "tram",
  plane: "airplane",
  ship: "ferry",
  truck: "truck-outline",
  fuel: "gas-station-outline",
  navigation: "navigation-outline",
  route: "map-marker-path",
  caravan: "rv-truck",
  // Money & aid
  coins: "cash-multiple",
  banknote: "cash",
  wallet: "wallet-outline",
  "credit-card": "credit-card-outline",
  "hand-coins": "hand-coin-outline",
  gift: "gift-outline",
  "piggy-bank": "piggy-bank-outline",
  euro: "currency-eur",
  calculator: "calculator",
  handshake: "handshake-outline",
  "heart-handshake": "hand-heart-outline",
  "hand-helping": "hand-heart-outline",
  // Education & language
  "graduation-cap": "school-outline",
  "book-marked": "bookmark-outline",
  library: "library-outline",
  languages: "translate",
  ruler: "ruler",
  school: "school-outline",
  puzzle: "puzzle-outline",
  // Work & tools
  briefcase: "briefcase-outline",
  hammer: "hammer",
  wrench: "wrench-outline",
  "hard-hat": "hard-hat",
  paintbrush: "brush",
  cog: "cog-outline",
  settings: "cog-outline",
  // People & family
  users: "account-group-outline",
  "users-round": "account-group-outline",
  user: "account-outline",
  "user-round": "account-outline",
  "user-plus": "account-plus-outline",
  "person-standing": "human",
  baby: "baby-face-outline",
  // Community & activities
  "party-popper": "party-popper",
  sparkles: "shimmer",
  music: "music",
  guitar: "guitar-acoustic",
  palette: "palette-outline",
  "gamepad-2": "gamepad-variant-outline",
  trophy: "trophy-outline",
  medal: "medal-outline",
  dumbbell: "dumbbell",
  film: "movie-outline",
  // Safety & security
  shield: "shield-outline",
  "shield-check": "shield-check-outline",
  "shield-alert": "shield-alert-outline",
  lock: "lock-outline",
  unlock: "lock-open-outline",
  siren: "alarm-light-outline",
  "triangle-alert": "alert-outline",
  "octagon-alert": "alert-octagon-outline",
  "circle-alert": "alert-circle-outline",
  ban: "cancel",
  flashlight: "flashlight",
  "life-buoy": "lifebuoy",
  // Time & scheduling
  clock: "clock-outline",
  calendar: "calendar-outline",
  "calendar-check": "calendar-check-outline",
  "calendar-days": "calendar-month-outline",
  "calendar-clock": "calendar-clock-outline",
  hourglass: "timer-sand",
  timer: "timer-outline",
  "alarm-clock": "alarm",
  history: "history",
  // Nature & animals
  "tree-pine": "pine-tree",
  "tree-deciduous": "tree-outline",
  trees: "forest",
  leaf: "leaf",
  sprout: "sprout-outline",
  flower: "flower-outline",
  mountain: "image-filter-hdr",
  dog: "dog",
  cat: "cat",
  bird: "bird",
  "paw-print": "paw",
  // Religion & culture
  church: "church",
  star: "star-outline",
  "moon-star": "weather-night",
};

/**
 * Icon codes seeded before the vocabulary matched Lucide names. The web reader
 * keeps the same aliases, so a row saved years ago draws the same picture on
 * both surfaces.
 */
const legacyAliases: Record<string, Glyph> = {
  help: "help-circle-outline",
  home: "home-outline",
  alert: "alert-outline",
  door: "door",
  calendar: "calendar-outline",
};

/** What an unknown code draws: a question, not a wrong answer. */
const unknownGlyph: Glyph = "help-circle-outline";

export function TaxonomyIcon({
  name,
  size = 16,
  color,
}: {
  name?: string | null;
  size?: number;
  color?: string;
}) {
  const { tokens } = useInfoKitTheme();
  const glyph = name
    ? (taxonomyGlyphs[name] ?? legacyAliases[name] ?? unknownGlyph)
    : unknownGlyph;

  return (
    <MaterialCommunityIcons
      name={glyph}
      size={size}
      // Icons on a chip or a card are accentDeep (docs/DESIGN-SYSTEM.md §5).
      color={color ?? tokens.accentDeep}
    />
  );
}

// ---------------------------------------------------------------------------
// Theme definitions
//
// Tailwind v4's `@theme` directive defines CSS variables on :root. We override
// these at runtime via document.documentElement.style.setProperty(), so the
// same `bg-surface-*` / `text-accent-*` utilities pick up new colors without
// touching any component code.
//
// Surface scale convention:
//   dark  → surface-950 = darkest (app background), surface-100 = lightest (text)
//   light → surface-950 = lightest (app background), surface-100 = darkest (text)
// The class names never change; only the values flip.
//
// Curated for development: high contrast, neutral backgrounds, syntax-friendly
// accents. Inspired by popular editor palettes (One Dark, Dracula, Nord,
// Tokyo Night, GitHub, Solarized).
// ---------------------------------------------------------------------------

export interface ThemeColors {
  "--color-surface-950": string;
  "--color-surface-900": string;
  "--color-surface-800": string;
  "--color-surface-700": string;
  "--color-surface-600": string;
  "--color-surface-500": string;
  "--color-surface-400": string;
  "--color-surface-300": string;
  "--color-surface-200": string;
  "--color-surface-100": string;
  "--color-accent-cyan": string;
  "--color-accent-cyan-dim": string;
  "--color-accent-emerald": string;
  "--color-accent-amber": string;
  "--color-accent-rose": string;
  "--color-accent-indigo": string;
}

export interface Theme {
  id: string;
  name: string; // Chinese display name
  nameEn: string; // English display name
  mode: "light" | "dark";
  /** 5 preview swatches for the settings card. */
  swatches: [string, string, string, string, string];
  colors: ThemeColors;
}

export const themes: Theme[] = [
  // ── Dark: deep sea blue (default) ───────────────────────────────────────
  // Neutral near-black with cyan accent. Easy on the eyes, default choice.
  {
    id: "deep_sea_blue_dark",
    name: "深海蓝",
    nameEn: "Deep Sea Blue",
    mode: "dark",
    swatches: ["#09090b", "#27272a", "#22d3ee", "#34d399", "#818cf8"],
    colors: {
      "--color-surface-950": "#09090b",
      "--color-surface-900": "#18181b",
      "--color-surface-800": "#27272a",
      "--color-surface-700": "#3f3f46",
      "--color-surface-600": "#52525b",
      "--color-surface-500": "#71717a",
      "--color-surface-400": "#a1a1aa",
      "--color-surface-300": "#d4d4d8",
      "--color-surface-200": "#e4e4e7",
      "--color-surface-100": "#f4f4f5",
      "--color-accent-cyan": "#22d3ee",
      "--color-accent-cyan-dim": "#0e7490",
      "--color-accent-emerald": "#34d399",
      "--color-accent-amber": "#fbbf24",
      "--color-accent-rose": "#fb7185",
      "--color-accent-indigo": "#818cf8",
    },
  },
  // ── Dark: midnight (One Dark inspired) ──────────────────────────────────
  // Slate-blue background, blue primary. The most popular editor palette family.
  {
    id: "midnight_dark",
    name: "午夜暗",
    nameEn: "Midnight",
    mode: "dark",
    swatches: ["#0a0e1a", "#1e293b", "#3b82f6", "#10b981", "#a78bfa"],
    colors: {
      "--color-surface-950": "#0a0e1a",
      "--color-surface-900": "#0f172a",
      "--color-surface-800": "#1e293b",
      "--color-surface-700": "#334155",
      "--color-surface-600": "#475569",
      "--color-surface-500": "#64748b",
      "--color-surface-400": "#94a3b8",
      "--color-surface-300": "#cbd5e1",
      "--color-surface-200": "#e2e8f0",
      "--color-surface-100": "#f1f5f9",
      "--color-accent-cyan": "#3b82f6",
      "--color-accent-cyan-dim": "#1e40af",
      "--color-accent-emerald": "#10b981",
      "--color-accent-amber": "#f59e0b",
      "--color-accent-rose": "#ef4444",
      "--color-accent-indigo": "#a78bfa",
    },
  },
  // ── Dark: violet (Dracula inspired) ─────────────────────────────────────
  // Deep purple background with vibrant accent. High energy, high contrast.
  {
    id: "violet_dark",
    name: "紫罗兰暗",
    nameEn: "Violet Dark",
    mode: "dark",
    swatches: ["#110a1a", "#241634", "#a855f7", "#ec4899", "#60a5fa"],
    colors: {
      "--color-surface-950": "#110a1a",
      "--color-surface-900": "#1a0f2e",
      "--color-surface-800": "#241634",
      "--color-surface-700": "#3a2455",
      "--color-surface-600": "#4e3570",
      "--color-surface-500": "#6c4f93",
      "--color-surface-400": "#987bb8",
      "--color-surface-300": "#c4afd6",
      "--color-surface-200": "#e0d2ec",
      "--color-surface-100": "#f1eaf7",
      "--color-accent-cyan": "#a855f7",
      "--color-accent-cyan-dim": "#6b21a8",
      "--color-accent-emerald": "#10b981",
      "--color-accent-amber": "#f59e0b",
      "--color-accent-rose": "#ec4899",
      "--color-accent-indigo": "#60a5fa",
    },
  },
  // ── Dark: Nord (Polar Night) ────────────────────────────────────────────
  // Cool blue-gray, arctic palette. Calm, restrained, excellent for long sessions.
  {
    id: "nord_dark",
    name: "极夜",
    nameEn: "Nord",
    mode: "dark",
    swatches: ["#2e3440", "#3b4252", "#88c0d0", "#a3be8c", "#5e81ac"],
    colors: {
      "--color-surface-950": "#2e3440",
      "--color-surface-900": "#3b4252",
      "--color-surface-800": "#434c5e",
      "--color-surface-700": "#4c566a",
      "--color-surface-600": "#5e6477",
      "--color-surface-500": "#7b88a8",
      "--color-surface-400": "#9ba8c0",
      "--color-surface-300": "#c4cee0",
      "--color-surface-200": "#d8dee9",
      "--color-surface-100": "#eceff4",
      "--color-accent-cyan": "#88c0d0",
      "--color-accent-cyan-dim": "#5e81ac",
      "--color-accent-emerald": "#a3be8c",
      "--color-accent-amber": "#ebcb8b",
      "--color-accent-rose": "#bf616a",
      "--color-accent-indigo": "#b48ead",
    },
  },
  // ── Dark: Tokyo Night ───────────────────────────────────────────────────
  // Modern muted blue-purple. Clean, balanced, very popular for code editors.
  {
    id: "tokyo_night_dark",
    name: "东京夜",
    nameEn: "Tokyo Night",
    mode: "dark",
    swatches: ["#1a1b26", "#1f2335", "#7aa2f7", "#9ece6a", "#bb9af7"],
    colors: {
      "--color-surface-950": "#1a1b26",
      "--color-surface-900": "#16161e",
      "--color-surface-800": "#1f2335",
      "--color-surface-700": "#292e42",
      "--color-surface-600": "#3b4261",
      "--color-surface-500": "#565f89",
      "--color-surface-400": "#7a88a3",
      "--color-surface-300": "#a9b1d6",
      "--color-surface-200": "#c0caf5",
      "--color-surface-100": "#e6e7fa",
      "--color-accent-cyan": "#7dcfff",
      "--color-accent-cyan-dim": "#7aa2f7",
      "--color-accent-emerald": "#9ece6a",
      "--color-accent-amber": "#e0af68",
      "--color-accent-rose": "#f7768e",
      "--color-accent-indigo": "#bb9af7",
    },
  },
  // ── Light: slate gray (GitHub inspired) ─────────────────────────────────
  // Neutral gray-blue, clean and professional. Great default for daytime.
  {
    id: "slate_gray_light",
    name: "石板灰",
    nameEn: "Slate Gray",
    mode: "light",
    swatches: ["#f8fafc", "#e2e8f0", "#0ea5e9", "#10b981", "#64748b"],
    colors: {
      "--color-surface-950": "#f8fafc",
      "--color-surface-900": "#f1f5f9",
      "--color-surface-800": "#e2e8f0",
      "--color-surface-700": "#cbd5e1",
      "--color-surface-600": "#94a3b8",
      "--color-surface-500": "#64748b",
      "--color-surface-400": "#475569",
      "--color-surface-300": "#334155",
      "--color-surface-200": "#1e293b",
      "--color-surface-100": "#0f172a",
      "--color-accent-cyan": "#0ea5e9",
      "--color-accent-cyan-dim": "#0369a1",
      "--color-accent-emerald": "#10b981",
      "--color-accent-amber": "#d97706",
      "--color-accent-rose": "#e11d48",
      "--color-accent-indigo": "#6366f1",
    },
  },
  // ── Light: ocean blue ───────────────────────────────────────────────────
  // Bright sky background with blue accent. Fresh and focused.
  {
    id: "ocean_blue_light",
    name: "海洋蓝",
    nameEn: "Ocean Blue",
    mode: "light",
    swatches: ["#f0f9ff", "#bae6fd", "#0284c7", "#0d9488", "#6366f1"],
    colors: {
      "--color-surface-950": "#f0f9ff",
      "--color-surface-900": "#e0f2fe",
      "--color-surface-800": "#bae6fd",
      "--color-surface-700": "#7dd3fc",
      "--color-surface-600": "#38bdf8",
      "--color-surface-500": "#0ea5e9",
      "--color-surface-400": "#0284c7",
      "--color-surface-300": "#0369a1",
      "--color-surface-200": "#075985",
      "--color-surface-100": "#0c4a6e",
      "--color-accent-cyan": "#0284c7",
      "--color-accent-cyan-dim": "#0e7490",
      "--color-accent-emerald": "#0d9488",
      "--color-accent-amber": "#d97706",
      "--color-accent-rose": "#e11d48",
      "--color-accent-indigo": "#6366f1",
    },
  },
  // ── Light: Solarized Light ──────────────────────────────────────────────
  // Warm cream background, classic dev palette. Low strain for long reading.
  {
    id: "solarized_light",
    name: "暖砂",
    nameEn: "Solarized Light",
    mode: "light",
    swatches: ["#fdf6e3", "#eee8d5", "#268bd2", "#859900", "#d33682"],
    colors: {
      "--color-surface-950": "#fdf6e3",
      "--color-surface-900": "#f5efdc",
      "--color-surface-800": "#eee8d5",
      "--color-surface-700": "#d6cfb6",
      "--color-surface-600": "#b3ac8e",
      "--color-surface-500": "#8b8670",
      "--color-surface-400": "#657b83",
      "--color-surface-300": "#586e75",
      "--color-surface-200": "#3f5260",
      "--color-surface-100": "#073642",
      "--color-accent-cyan": "#2aa198",
      "--color-accent-cyan-dim": "#268bd2",
      "--color-accent-emerald": "#859900",
      "--color-accent-amber": "#b58900",
      "--color-accent-rose": "#dc322f",
      "--color-accent-indigo": "#6c71c4",
    },
  },
];

export const DEFAULT_THEME_ID = "deep_sea_blue_dark";

export function getThemeById(id: string): Theme | undefined {
  return themes.find((t) => t.id === id);
}

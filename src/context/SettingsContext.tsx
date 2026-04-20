import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  FONTS,
  DEFAULT_SETTINGS,
  type Settings,
  type FontId,
} from "../types/settings";

interface SettingsContextType {
  settings: Settings;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  isMobile: boolean;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: DEFAULT_SETTINGS,
  setSetting: () => {},
  isMobile: false,
});

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem("ryplay-settings");
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

// Track which font stylesheets have been loaded
const loadedFonts = new Set<string>(["inter"]);

const FONT_URLS: Record<string, string> = {
  "jetbrains-mono":
    "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap",
  "space-grotesk":
    "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap",
  outfit:
    "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap",
  sora: "https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&display=swap",
};

function ensureFontLoaded(fontId: string) {
  if (loadedFonts.has(fontId)) return;
  const url = FONT_URLS[fontId];
  if (!url) return;
  loadedFonts.add(fontId);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = url;
  document.head.appendChild(link);
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia("(max-width: 639px)").matches,
  );

  // Persist on change
  useEffect(() => {
    localStorage.setItem("ryplay-settings", JSON.stringify(settings));
  }, [settings]);

  // Apply font globally (lazy-load stylesheet if needed)
  useEffect(() => {
    const font = FONTS.find((f) => f.id === settings.fontId);
    ensureFontLoaded(settings.fontId);
    if (font && font.id !== "inter") {
      document.body.style.fontFamily = `"${font.family}", system-ui, -apple-system, sans-serif`;
    } else {
      document.body.style.fontFamily = "";
    }
  }, [settings.fontId]);

  // Mobile detection
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const setSetting = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  return (
    <SettingsContext.Provider value={{ settings, setSetting, isMobile }}>
      {children}
    </SettingsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSettings() {
  return useContext(SettingsContext);
}

export type { FontId };

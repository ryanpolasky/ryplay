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

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [isMobile, setIsMobile] = useState(false);

  // Persist on change
  useEffect(() => {
    localStorage.setItem("ryplay-settings", JSON.stringify(settings));
  }, [settings]);

  // Apply font globally
  useEffect(() => {
    const font = FONTS.find((f) => f.id === settings.fontId);
    if (font && font.id !== "inter") {
      document.body.style.fontFamily = `"${font.family}", system-ui, -apple-system, sans-serif`;
    } else {
      document.body.style.fontFamily = "";
    }
  }, [settings.fontId]);

  // Mobile detection
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    setIsMobile(mq.matches);
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

export function useSettings() {
  return useContext(SettingsContext);
}

export type { FontId };

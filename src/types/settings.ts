export type FontId =
  | "inter"
  | "jetbrains-mono"
  | "space-grotesk"
  | "outfit"
  | "sora";

export interface FontDef {
  id: FontId;
  name: string;
  family: string;
}

export const FONTS: FontDef[] = [
  { id: "inter", name: "Inter", family: "Inter" },
  { id: "jetbrains-mono", name: "JetBrains Mono", family: "JetBrains Mono" },
  { id: "space-grotesk", name: "Space Grotesk", family: "Space Grotesk" },
  { id: "outfit", name: "Outfit", family: "Outfit" },
  { id: "sora", name: "Sora", family: "Sora" },
];

export interface Settings {
  backgroundId: string;
  fontId: FontId;
}

export const DEFAULT_SETTINGS: Settings = {
  backgroundId: "default",
  fontId: "inter",
};

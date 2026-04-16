import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "../context/UserContext";
import { useSettings } from "../context/SettingsContext";
import { useNowPlaying } from "../hooks/useNowPlaying";
import { useArtworkPalette } from "../hooks/useArtworkPalette";
import { getBackground } from "../lib/backgrounds";
import Logo from "./Logo";
import NavDots from "./NavDots";
import NowPlayingToast from "./NowPlayingToast";
import SettingsCog from "./SettingsCog";
import SettingsPanel from "./SettingsPanel";
import { setGradientFavicon } from "../lib/favicon";
import NowPlaying from "./NowPlaying";
import RecentlyPlayed from "./RecentlyPlayed";
import StatsPanel from "./StatsPanel";
import TopList from "./TopList";
import GenreBreakdown from "./GenreBreakdown";
import ListeningClock from "./ListeningClock";
import Panel from "./Panel";
import type { PaletteColors } from "../types/lastfm";

const DEFAULT_PALETTE: PaletteColors = {
  dominant: "#404040",
  muted: "#262626",
  vibrant: "#525252",
  light: "#737373",
  dark: "#171717",
};

const PANELS = [
  { id: "now-playing", label: "Now Playing" },
  { id: "recent", label: "Recent" },
  { id: "stats", label: "Stats" },
  { id: "top-artists", label: "Artists" },
  { id: "top-tracks", label: "Tracks" },
  { id: "top-albums", label: "Albums" },
  { id: "genres", label: "Genres" },
  { id: "clock", label: "Clock" },
];

export default function Dashboard() {
  const { username, setUsername } = useUser();
  const { settings, isMobile } = useSettings();
  const [activePage, setActivePage] = useState(0);
  const [colors, setColors] = useState<PaletteColors>(DEFAULT_PALETTE);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<{
    title: string;
    artist: string;
    artworkUrl?: string;
  } | null>(null);
  const prevTitleRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLElement>(null);
  const idleTimer = useRef<number>(0);
  const wakeChrome = useCallback(() => {
    setChromeVisible(true);
    clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(
      () => setChromeVisible(false),
      15_000,
    );
  }, []);

  const { music, loading: musicLoading } = useNowPlaying(username!);
  const { palette, isExtracted } = useArtworkPalette(music?.artworkUrl ?? null);

  useEffect(() => {
    setColors(palette);
    setGradientFavicon(
      isExtracted ? palette.vibrant : "#c4b5fd",
      isExtracted ? palette.light : "#f0abfc",
    );
  }, [palette, isExtracted]);

  // Update tab title with current track
  useEffect(() => {
    document.title = music?.title ? `ryplay | ${music.title}` : "ryplay";
  }, [music?.title]);

  // Show toast when track changes while not on now-playing page
  useEffect(() => {
    const newTitle = music?.title ?? null;
    if (
      prevTitleRef.current !== null &&
      newTitle &&
      newTitle !== prevTitleRef.current &&
      activePage !== 0
    ) {
      setToast({
        title: newTitle,
        artist: music?.artist ?? "",
        artworkUrl: music?.artworkUrl,
      });
      const timer = setTimeout(() => setToast(null), 4000);
      prevTitleRef.current = newTitle;
      return () => clearTimeout(timer);
    }
    prevTitleRef.current = newTitle;
  }, [music?.title, music?.artist, music?.artworkUrl]);

  // Auto-hide chrome after 15s idle or on window blur
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        clearTimeout(idleTimer.current);
        setChromeVisible(false);
      } else {
        wakeChrome();
      }
    };

    const onBlur = () => {
      clearTimeout(idleTimer.current);
      setChromeVisible(false);
    };

    wakeChrome();
    window.addEventListener("mousemove", wakeChrome);
    window.addEventListener("mousedown", wakeChrome);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", wakeChrome);
    return () => {
      clearTimeout(idleTimer.current);
      window.removeEventListener("mousemove", wakeChrome);
      window.removeEventListener("mousedown", wakeChrome);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", wakeChrome);
    };
  }, [wakeChrome]);

  const activePageRef = useRef(0);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const scrollMid = el.scrollTop + el.clientHeight / 2;
    let closest = 0;
    let closestDist = Infinity;
    for (let i = 0; i < el.children.length; i++) {
      const child = el.children[i] as HTMLElement;
      const childMid = child.offsetTop + child.offsetHeight / 2;
      const dist = Math.abs(scrollMid - childMid);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    }
    const page = Math.min(PANELS.length - 1, closest);
    activePageRef.current = page;
    setActivePage(page);
  }, []);

  // Arrow key navigation between panels
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const current = activePageRef.current;
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        const next = Math.min(PANELS.length - 1, current + 1);
        scrollToPage(next);
        wakeChrome();
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        const prev = Math.max(0, current - 1);
        scrollToPage(prev);
        wakeChrome();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [wakeChrome]);

  const scrollToPage = (i: number) => {
    scrollRef.current?.children[i]?.scrollIntoView({ behavior: "smooth" });
  };

  if (!username) return null;

  const activeBg = getBackground(settings.backgroundId);
  const BgComponent = activeBg?.component;

  return (
    <div className="h-dvh w-screen overflow-hidden bg-[#060609] text-white">
      {/* Dynamic background */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        {BgComponent && (
          <BgComponent
            colors={colors}
            isMobile={isMobile}
            artworkUrl={music?.artworkUrl}
          />
        )}
      </div>

      {/* Now playing toast */}
      <AnimatePresence>
        {toast && (
          <NowPlayingToast
            title={toast.title}
            artist={toast.artist}
            artworkUrl={toast.artworkUrl}
            colors={colors}
            onClose={() => setToast(null)}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.header
        animate={{ opacity: chromeVisible ? 1 : 0, y: chromeVisible ? 0 : -8 }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 h-12"
        style={{ pointerEvents: chromeVisible ? "auto" : "none" }}
      >
        <Logo colors={colors} hasArtwork={isExtracted} className="text-base" />
        <div className="group/user relative">
          <span className="text-sm text-white/40 cursor-default">
            {username}
          </span>
          <button
            onClick={() => setUsername(null)}
            className="absolute top-full right-0 mt-1 text-[10px] text-white/30 hover:text-white/60 tracking-wide uppercase whitespace-nowrap cursor-pointer opacity-0 translate-y-[-4px] group-hover/user:opacity-100 group-hover/user:translate-y-0 transition-all duration-200 ease-out"
          >
            {localStorage.getItem("ryplay-username")
              ? "disconnect"
              : "try yours"}
          </button>
        </div>
      </motion.header>

      {/* Dot navigation — expands to ToC on hover */}
      <NavDots
        panels={PANELS}
        activePage={activePage}
        colors={colors}
        onNavigate={scrollToPage}
        visible={chromeVisible}
      />

      {/* Settings */}
      <SettingsCog
        onClick={() => setSettingsOpen(true)}
        visible={chromeVisible}
        colors={colors}
      />
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        colors={colors}
      />

      {/* Scroll-snap container */}
      <main
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-dvh overflow-y-auto snap-y snap-mandatory scrollbar-hide relative z-10"
      >
        <Panel id="now-playing">
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-2xl">
              <NowPlaying
                username={username}
                music={music}
                colors={colors}
                loading={musicLoading}
              />
            </div>
          </div>
        </Panel>

        <Panel id="recent">
          <div className="flex-1 flex flex-col justify-center max-w-2xl mx-auto w-full">
            <RecentlyPlayed
              tracks={music?.recentTracks ?? []}
              colors={colors}
            />
          </div>
        </Panel>

        <Panel id="stats">
          <div className="flex-1 flex flex-col justify-center max-w-2xl mx-auto w-full">
            <StatsPanel
              username={username}
              colors={colors}
              artworkUrl={music?.artworkUrl}
              currentTrack={
                music?.isPlaying && music?.title
                  ? { title: music.title, artist: music.artist ?? "" }
                  : null
              }
            />
          </div>
        </Panel>

        <TopList
          username={username}
          type="artists"
          title="Top Artists"
          id="top-artists"
          colors={colors}
        />
        <TopList
          username={username}
          type="tracks"
          title="Top Tracks"
          id="top-tracks"
          colors={colors}
        />
        <TopList
          username={username}
          type="albums"
          title="Top Albums"
          id="top-albums"
          colors={colors}
        />

        <GenreBreakdown username={username} colors={colors} />
        <ListeningClock username={username} colors={colors} />
      </main>
    </div>
  );
}

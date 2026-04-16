import { useState, useRef, useCallback, useEffect, useMemo } from "react";
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
import ErrorBoundary from "./ErrorBoundary";
import { setGradientFavicon } from "../lib/favicon";
import NowPlaying from "./NowPlaying";
import RecentlyPlayed from "./RecentlyPlayed";
import StatsPanel from "./StatsPanel";
import TopList from "./TopList";
import GenreBreakdown from "./GenreBreakdown";
import ListeningClock from "./ListeningClock";
import { DEFAULT_PALETTE, type PaletteColors } from "../types/lastfm";

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
  const [activePage, setActivePage] = useState(() => {
    const hash = window.location.hash.slice(1);
    const idx = PANELS.findIndex((p) => p.id === hash);
    return idx >= 0 ? idx : 0;
  });
  const [colors, setColors] = useState<PaletteColors>(DEFAULT_PALETTE);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showHint, setShowHint] = useState(
    () => !localStorage.getItem("ryplay-username"),
  );
  const [toast, setToast] = useState<{
    title: string;
    artist: string;
    artworkUrl?: string;
  } | null>(null);
  // Track which panels have been visited (for deferred rendering)
  const [visitedPanels, setVisitedPanels] = useState<Set<number>>(
    () => new Set([0]),
  );
  const prevTitleRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLElement>(null);
  const idleTimer = useRef<number>(0);
  const lastWakeTime = useRef(0);
  const activePageRef = useRef(0);
  const rafId = useRef(0);
  const updatingHash = useRef(false);

  const wakeChrome = useCallback(() => {
    setChromeVisible(true);
    clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(
      () => setChromeVisible(false),
      15_000,
    );
  }, []);

  // Throttled mousemove handler (~150ms)
  const throttledWake = useCallback(() => {
    const now = Date.now();
    if (now - lastWakeTime.current < 150) return;
    lastWakeTime.current = now;
    wakeChrome();
  }, [wakeChrome]);

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
  // activePage is intentionally excluded — we only want to fire on track change, not on scroll
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    window.addEventListener("mousemove", throttledWake);
    window.addEventListener("mousedown", wakeChrome);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", wakeChrome);
    return () => {
      clearTimeout(idleTimer.current);
      window.removeEventListener("mousemove", throttledWake);
      window.removeEventListener("mousedown", wakeChrome);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", wakeChrome);
    };
  }, [wakeChrome, throttledWake]);

  // Auto-dismiss first-visit hint
  useEffect(() => {
    if (!showHint) return;
    const el = scrollRef.current;
    const dismiss = () => setShowHint(false);
    const autoTimer = setTimeout(dismiss, 7000);
    const attachTimer = window.setTimeout(() => {
      window.addEventListener("click", dismiss, { once: true });
      el?.addEventListener("scroll", dismiss, { once: true });
    }, 1500);
    return () => {
      clearTimeout(autoTimer);
      clearTimeout(attachTimer);
      window.removeEventListener("click", dismiss);
      el?.removeEventListener("scroll", dismiss);
    };
  }, [showHint]);

  // Mark panels as visited when they come into range
  useEffect(() => {
    setVisitedPanels((prev) => {
      const next = new Set(prev);
      // Pre-render activePage ± 1
      for (
        let i = Math.max(0, activePage - 1);
        i <= Math.min(PANELS.length - 1, activePage + 1);
        i++
      ) {
        next.add(i);
      }
      return next.size === prev.size ? prev : next;
    });
  }, [activePage]);

  // Update URL hash when active page changes
  useEffect(() => {
    const id = PANELS[activePage]?.id;
    if (id) {
      updatingHash.current = true;
      window.history.replaceState(null, "", `#${id}`);
      // Allow hashchange listener to settle
      requestAnimationFrame(() => {
        updatingHash.current = false;
      });
    }
  }, [activePage]);

  // Listen for hashchange (e.g., direct URL navigation)
  useEffect(() => {
    const onHashChange = () => {
      if (updatingHash.current) return;
      const hash = window.location.hash.slice(1);
      const idx = PANELS.findIndex((p) => p.id === hash);
      if (idx >= 0) scrollToPage(idx);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Scroll to initial hash on mount
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const idx = PANELS.findIndex((p) => p.id === hash);
    if (idx > 0) {
      // Delay slightly to let panels render
      requestAnimationFrame(() => scrollToPage(idx));
    }
  }, []);

  // RAF-guarded scroll handler
  const handleScroll = useCallback(() => {
    if (rafId.current) return;
    rafId.current = requestAnimationFrame(() => {
      rafId.current = 0;
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
    });
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

  // Determine which panels should render content
  const shouldRender = useMemo(() => {
    return PANELS.map((_, i) => visitedPanels.has(i));
  }, [visitedPanels]);

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

      {/* First-visit hint pointing at username */}
      <AnimatePresence>
        {showHint && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{
              delay: 1,
              type: "spring",
              stiffness: 400,
              damping: 28,
            }}
            className="fixed top-14 right-4 sm:right-6 z-40 flex flex-col items-end gap-1.5 pointer-events-none"
          >
            <svg
              width="16"
              height="10"
              viewBox="0 0 16 10"
              className="mr-3 text-white/80"
            >
              <path d="M8 0L16 10H0z" fill="currentColor" />
            </svg>
            <div className="rounded-xl bg-white/10 backdrop-blur-xl ring-1 ring-white/15 px-4 py-3 max-w-[220px]">
              <p className="text-sm text-white/80 leading-snug">
                tap the username above to switch users or enter your own
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
        <ErrorBoundary>
          <NowPlaying
            username={username}
            music={music}
            colors={colors}
            loading={musicLoading}
          />
        </ErrorBoundary>

        <ErrorBoundary>
          {shouldRender[1] ? (
            <RecentlyPlayed
              tracks={music?.recentTracks ?? []}
              colors={colors}
            />
          ) : (
            <section id="recent" className="min-h-dvh snap-start snap-always" />
          )}
        </ErrorBoundary>

        <ErrorBoundary>
          {shouldRender[2] ? (
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
          ) : (
            <section id="stats" className="min-h-dvh snap-start snap-always" />
          )}
        </ErrorBoundary>

        <ErrorBoundary>
          {shouldRender[3] ? (
            <TopList
              username={username}
              type="artists"
              title="Top Artists"
              id="top-artists"
              colors={colors}
            />
          ) : (
            <section
              id="top-artists"
              className="min-h-dvh snap-start snap-always"
            />
          )}
        </ErrorBoundary>

        <ErrorBoundary>
          {shouldRender[4] ? (
            <TopList
              username={username}
              type="tracks"
              title="Top Tracks"
              id="top-tracks"
              colors={colors}
            />
          ) : (
            <section
              id="top-tracks"
              className="min-h-dvh snap-start snap-always"
            />
          )}
        </ErrorBoundary>

        <ErrorBoundary>
          {shouldRender[5] ? (
            <TopList
              username={username}
              type="albums"
              title="Top Albums"
              id="top-albums"
              colors={colors}
            />
          ) : (
            <section
              id="top-albums"
              className="min-h-dvh snap-start snap-always"
            />
          )}
        </ErrorBoundary>

        <ErrorBoundary>
          {shouldRender[6] ? (
            <GenreBreakdown username={username} colors={colors} />
          ) : (
            <section id="genres" className="min-h-dvh snap-start snap-always" />
          )}
        </ErrorBoundary>

        <ErrorBoundary>
          {shouldRender[7] ? (
            <ListeningClock username={username} colors={colors} />
          ) : (
            <section id="clock" className="min-h-dvh snap-start snap-always" />
          )}
        </ErrorBoundary>
      </main>
    </div>
  );
}

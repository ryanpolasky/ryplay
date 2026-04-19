import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UserProvider, useUser } from "./context/UserContext";
import { SettingsProvider } from "./context/SettingsContext";
import Landing from "./components/Landing";
import Dashboard from "./components/Dashboard";
import { lazy, Suspense } from "react";

const SpotifyDashboard = lazy(() => import("./components/SpotifyDashboard"));
const SpotifyCallback = lazy(() => import("./components/SpotifyCallback"));

function AppContent() {
  const { username, spotifySession } = useUser();
  const [path, setPath] = useState(
    () => window.location.pathname.replace(/^\/+|\/+$/g, ""),
  );

  useEffect(() => {
    const onPopState = () => {
      setPath(window.location.pathname.replace(/^\/+|\/+$/g, ""));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Also update path when username/spotify state changes (they pushState)
  useEffect(() => {
    setPath(window.location.pathname.replace(/^\/+|\/+$/g, ""));
  }, [username, spotifySession]);

  // Determine which view to show
  let view: "callback" | "spotify" | "dashboard" | "landing";
  if (path.startsWith("spotify/callback")) {
    view = "callback";
  } else if (path === "spotify" && spotifySession) {
    view = "spotify";
  } else if (username) {
    view = "dashboard";
  } else {
    view = "landing";
  }

  return (
    <AnimatePresence mode="wait">
      {view === "callback" ? (
        <Suspense
          fallback={
            <div className="h-dvh w-screen bg-[#060609] flex items-center justify-center text-white/30 text-sm">
              connecting...
            </div>
          }
        >
          <SpotifyCallback key="callback" />
        </Suspense>
      ) : view === "spotify" ? (
        <motion.div
          key="spotify"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Suspense
            fallback={
              <div className="h-dvh w-screen bg-[#060609]" />
            }
          >
            <SpotifyDashboard />
          </Suspense>
        </motion.div>
      ) : view === "dashboard" ? (
        <motion.div
          key="dashboard"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Dashboard />
        </motion.div>
      ) : (
        <motion.div
          key="landing"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Landing />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <UserProvider>
      <SettingsProvider>
        <AppContent />
      </SettingsProvider>
    </UserProvider>
  );
}

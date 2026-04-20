import { motion, AnimatePresence } from "framer-motion";
import { UserProvider, useUser } from "./context/UserContext";
import { SettingsProvider } from "./context/SettingsContext";
import Landing from "./components/Landing";
import Dashboard from "./components/Dashboard";

// Spotify Lite Mode — commented out: Spotify killed indie dev API access (250k MAU requirement)
// import { useState, useEffect, lazy, Suspense } from "react";
// const SpotifyDashboard = lazy(() => import("./components/SpotifyDashboard"));
// const SpotifyCallback = lazy(() => import("./components/SpotifyCallback"));

function AppContent() {
  const { username } = useUser();

  return (
    <AnimatePresence mode="wait">
      {username ? (
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

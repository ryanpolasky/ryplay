import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { SpotifySession } from "../types/spotify";

interface UserContextType {
  username: string | null;
  setUsername: (username: string | null) => void;
  peekUsername: (username: string) => void;
  spotifySession: SpotifySession | null;
  setSpotifySession: (session: SpotifySession | null) => void;
}

const UserContext = createContext<UserContextType>({
  username: null,
  setUsername: () => {},
  peekUsername: () => {},
  spotifySession: null,
  setSpotifySession: () => {},
});

function usernameFromPath(): string | null {
  const path = window.location.pathname.replace(/^\/+|\/+$/g, "");
  if (path.startsWith("spotify")) return null;
  return path || null;
}

function isSpotifyPath(): boolean {
  const path = window.location.pathname.replace(/^\/+|\/+$/g, "");
  return path === "spotify";
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [username, setUsernameRaw] = useState<string | null>(() => {
    const fromUrl = usernameFromPath();
    if (fromUrl) return fromUrl;
    return localStorage.getItem("ryplay-username");
  });

  const [spotifySession, setSpotifySessionRaw] =
    useState<SpotifySession | null>(() => {
      // If we're on /spotify, try to restore session
      const saved = localStorage.getItem("ryplay-spotify-session");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return null;
        }
      }
      return null;
    });

  // On mount, sync URL with resolved username
  useEffect(() => {
    const fromUrl = usernameFromPath();
    if (username && !fromUrl && !isSpotifyPath()) {
      window.history.replaceState(null, "", `/${username}`);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle browser back/forward
  useEffect(() => {
    const onPopState = () => {
      const fromUrl = usernameFromPath();
      setUsernameRaw(fromUrl);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const setUsername = useCallback((name: string | null) => {
    setUsernameRaw(name);
    if (name) {
      localStorage.setItem("ryplay-username", name);
      window.history.pushState(null, "", `/${name}`);
    } else {
      localStorage.removeItem("ryplay-username");
      window.history.pushState(null, "", "/");
    }
  }, []);

  const peekUsername = useCallback((name: string) => {
    setUsernameRaw(name);
    window.history.pushState(null, "", `/${name}`);
  }, []);

  const setSpotifySession = useCallback((session: SpotifySession | null) => {
    setSpotifySessionRaw(session);
    if (session) {
      localStorage.setItem("ryplay-spotify-session", JSON.stringify(session));
      window.history.pushState(null, "", "/spotify");
    } else {
      localStorage.removeItem("ryplay-spotify-session");
      window.history.pushState(null, "", "/");
    }
  }, []);

  return (
    <UserContext.Provider
      value={{
        username,
        setUsername,
        peekUsername,
        spotifySession,
        setSpotifySession,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useUser = () => useContext(UserContext);

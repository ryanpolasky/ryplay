import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

interface UserContextType {
  username: string | null;
  setUsername: (username: string | null) => void;
  peekUsername: (username: string) => void;
}

const UserContext = createContext<UserContextType>({
  username: null,
  setUsername: () => {},
  peekUsername: () => {},
});

function usernameFromPath(): string | null {
  const path = window.location.pathname.replace(/^\/+|\/+$/g, "");
  return path || null;
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [username, setUsernameRaw] = useState<string | null>(() => {
    // Priority: URL path > localStorage
    const fromUrl = usernameFromPath();
    if (fromUrl) return fromUrl;
    return localStorage.getItem("ryplay-username");
  });

  // On mount, sync URL with resolved username
  useEffect(() => {
    const fromUrl = usernameFromPath();
    if (username && !fromUrl) {
      // Have a saved user but URL is "/", push to /{username}
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

  // Navigate to a profile without saving to localStorage (guest peek)
  const peekUsername = useCallback((name: string) => {
    setUsernameRaw(name);
    window.history.pushState(null, "", `/${name}`);
  }, []);

  return (
    <UserContext.Provider value={{ username, setUsername, peekUsername }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);

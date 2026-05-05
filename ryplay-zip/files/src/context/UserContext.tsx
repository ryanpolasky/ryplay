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
  // Reject anything that looks like a sub-path (Last.fm usernames don't
  // contain slashes), so /foo/bar doesn't get treated as a username.
  if (path.includes("/")) return null;
  return path || null;
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [username, setUsernameRaw] = useState<string | null>(() => {
    const fromUrl = usernameFromPath();
    if (fromUrl) return fromUrl;
    return localStorage.getItem("ryplay-username");
  });

  // On mount, sync URL with resolved username
  useEffect(() => {
    const fromUrl = usernameFromPath();
    if (username && !fromUrl) {
      window.history.replaceState(null, "", `/${username}`);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle browser back/forward
  useEffect(() => {
    const onPopState = () => {
      setUsernameRaw(usernameFromPath());
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

  return (
    <UserContext.Provider
      value={{
        username,
        setUsername,
        peekUsername,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useUser = () => useContext(UserContext);

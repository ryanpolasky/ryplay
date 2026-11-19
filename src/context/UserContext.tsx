import { createContext, useContext, type ReactNode } from "react";

const OWNER = "ryanpolasky";

const UserContext = createContext<{ username: string }>({ username: OWNER });

export function UserProvider({ children }: { children: ReactNode }) {
  return <UserContext.Provider value={{ username: OWNER }}>{children}</UserContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useUser = () => useContext(UserContext);

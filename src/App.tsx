import { UserProvider } from "./context/UserContext";
import { SettingsProvider } from "./context/SettingsContext";
import Dashboard from "./components/Dashboard";

export default function App() {
  return (
    <UserProvider>
      <SettingsProvider>
        <Dashboard />
      </SettingsProvider>
    </UserProvider>
  );
}

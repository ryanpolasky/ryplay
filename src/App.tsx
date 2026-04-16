import { UserProvider, useUser } from "./context/UserContext";
import { SettingsProvider } from "./context/SettingsContext";
import Landing from "./components/Landing";
import Dashboard from "./components/Dashboard";

function AppContent() {
  const { username } = useUser();
  return username ? <Dashboard /> : <Landing />;
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

import { ThemeProvider } from "./contexts/ThemeContext";
import Calendar from "./pages/Calendar";

function AppContent() {
  return (
    <div className="h-screen flex flex-col bg-slate-950">
      <main className="flex-1 overflow-auto p-6">
        <Calendar />
      </main>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;

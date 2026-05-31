import { ThemeProvider } from "./contexts/ThemeContext";
import Calendar from "./pages/Calendar";
import { Toaster } from "react-hot-toast";

import { useState } from "react";
import Today from "./pages/Today";

function AppContent() {
  const [section, setSection] = useState<"calendar" | "today">("calendar");

  return (
    <div className="h-screen flex flex-col bg-slate-950">
      <main className="flex-1 overflow-auto p-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-6">
          <button type="button" onClick={() => setSection("calendar")}>
            <h2
              className={`text-2xl font-bold cursor-pointer hover:text-indigo-400 transition-colors ${section === "calendar" ? "font-bold text-indigo-300" : "font-normal text-indigo-50"}`}
            >
              Calendar
            </h2>
          </button>
          <button type="button" onClick={() => setSection("today")}>
            <h2
              className={`text-2xl font-bold cursor-pointer hover:text-indigo-400 transition-colors ${section === "today" ? "font-bold text-indigo-300" : "font-normal text-indigo-50"}`}
            >
              Today
            </h2>
          </button>
        </div>

        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: "rgb(30, 27, 75)",
              color: "#fff",
              border: "1px solid rgb(79, 70, 229)",
              borderRadius: "0",
              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5)",
              padding: "16px",
              fontSize: "14px",
              fontWeight: "500",
            },
            success: {
              style: {
                background: "rgb(30, 27, 75)",
                color: "#fff",
                border: "1px solid rgb(79, 70, 229)",
              },
              iconTheme: {
                primary: "rgb(99, 102, 241)",
                secondary: "rgb(30, 27, 75)",
              },
            },
            error: {
              style: {
                background: "rgb(30, 27, 75)",
                color: "#fff",
                border: "1px solid rgb(220, 38, 38)",
              },
              iconTheme: {
                primary: "rgb(220, 38, 38)",
                secondary: "rgb(30, 27, 75)",
              },
            },
          }}
        />
        {section === "today" && <Today />}
        {section === "calendar" && <Calendar />}
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

import { Bell, Settings } from "lucide-react";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 header-gradient border-b border-slate-700 shadow-lg">
      <div className="flex items-center justify-between h-16 px-4">
        {/* Logo & Title */}
        <div className="flex items-center gap-3 flex-1">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-md">
            <span className="text-white font-bold text-sm">S</span>
          </div>
          <h1 className="text-lg font-bold text-white hidden sm:block">
            Scheduline
          </h1>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Notifications */}
          <button
            type="button"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors duration-200 relative group"
          >
            <Bell size={20} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            <div className="absolute right-0 mt-2 w-64 opacity-0 group-hover:opacity-100 bg-slate-800 rounded-lg shadow-lg p-3 pointer-events-none group-hover:pointer-events-auto transition-opacity duration-200">
              <p className="text-xs text-slate-400">No new notifications</p>
            </div>
          </button>

          {/* Settings */}
          <button
            type="button"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors duration-200"
          >
            <Settings size={20} />
          </button>
        </div>
      </div>
    </header>
  );
}

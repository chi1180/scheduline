import { useEffect, useRef } from "react";
import type { CalendarEvent } from "../../pages/Calendar";

const MIN_HOUR = 4;
const HOURS = Array.from({ length: 36 }, (_, i) => MIN_HOUR + i * 0.5); // 4:00 to 21:30 (30-min slots)

interface DayColumnProps {
  dayName: string;
  dayIndex: number;
  events: CalendarEvent[];
  isFocused: boolean;
  daySelected: boolean;
  selectedEventId?: string;
}

export function DayColumn({
  dayName,
  dayIndex,
  events,
  isFocused,
  daySelected,
  selectedEventId,
}: DayColumnProps) {
  const dayRef = useRef<HTMLDivElement>(null);
  const focusedEventRef = useRef<HTMLDivElement>(null);

  // Scroll focused day into view when focused
  useEffect(() => {
    if (isFocused && dayRef.current) {
      dayRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [isFocused]);

  // Scroll focused event into view
  useEffect(() => {
    if (selectedEventId && focusedEventRef.current) {
      focusedEventRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [selectedEventId]);

  const getEventStyle = (event: CalendarEvent) => {
    const slotIndex = Math.round((event.startHour - MIN_HOUR) * 2);
    const slotCount = Math.round(event.duration * 2);
    const leftOffset = slotIndex * 40;
    const width = slotCount * 40;
    return {
      left: `${leftOffset}px`,
      width: `${width}px`,
    };
  };

  const dayEvents = events.filter((e) => e.day === dayIndex);

  return (
    <div
      ref={dayRef}
      className={`flex border-b border-slate-700 transition-all border-l-4 ${
        daySelected
          ? "border-l-4 border-l-indigo-500"
          : isFocused
            ? "bg-slate-800 border-l-4 border-l-indigo-400"
            : ""
      }`}
      style={daySelected ? { backgroundColor: "rgb(30, 27, 75)" } : undefined}
    >
      {/* Day Label */}
      <div
        className={`w-28 font-semibold py-4 px-3 border-r border-slate-700 transition-all text-sm ${
          daySelected
            ? "bg-indigo-900 text-white"
            : isFocused
              ? "bg-slate-800 text-indigo-300"
              : "bg-slate-900 text-slate-300"
        }`}
      >
        {dayName.slice(0, 3)}
      </div>

      {/* Hour Slots */}
      <div
        className="flex gap-0 relative flex-shrink-0"
        style={{ width: `${HOURS.length * 40}px` }}
      >
        {HOURS.map((slot) => (
          <div
            key={`${dayIndex}-${slot}`}
            className={`w-10 flex-shrink-0 relative min-h-24 ${
              slot % 1 === 0
                ? "border-r border-slate-700"
                : "border-r border-slate-800"
            }`}
          />
        ))}

        {/* Events for this day */}
        {dayEvents.map((event) => (
          <div
            key={event.id}
            ref={selectedEventId === event.id ? focusedEventRef : null}
            style={getEventStyle(event)}
            className={`absolute top-2 h-20 text-white text-xs font-medium overflow-hidden transition-all z-10 bg-gray-500 ${
              selectedEventId === event.id
                ? "outline outline-2 outline-offset-2 outline-indigo-400 scale-105 shadow-indigo-500/40 shadow-lg"
                : ""
            }`}
          >
            <div
              className="truncate px-2 py-2 h-full flex items-center cursor-default"
              title={event.title}
            >
              {event.title}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

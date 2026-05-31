import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { CanvasCalendarGrid } from "../components/Calendar/CanvasCalendarGrid";
import { MIN_HOUR, MAX_HOUR, TIME_SLOTS } from "../components/Calendar/timeGrid";
import { indexDBAPI } from "../utils/indexDBAPI";

const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const formatHour = (h: number) => {
  const hour = Math.floor(h);
  const minute = (h - hour) * 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

export interface CalendarEvent {
  id: string;
  day: number;
  startHour: number;
  duration: number;
  title: string;
  color: string;
}

export default function Calendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Navigation state
  const [focusedDay, setFocusedDay] = useState(0);
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>();
  const [daySelected, setDaySelected] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{
    day: number;
    hour: number;
  } | null>(null);
  const [eventTitle, setEventTitle] = useState("");

  // Edit mode for selected day
  const [editingDayIndex, setEditingDayIndex] = useState<number | null>(null);

  // New event creation mode (from [n] key)
  const [creatingEvent, setCreatingEvent] = useState<{
    day: number;
    hour: number;
    duration: number;
  } | null>(null);

  // Temporary mode for time adjustment: after pressing 't', next 'h' or 'l' will extend event earlier/later
  const [timeAdjustMode, setTimeAdjustMode] = useState(false);
  // Track pressed keys (for combinations like holding 't' or 's' while pressing h/l)
  const pressedKeysRef = useRef<Set<string>>(new Set());

  // Delete confirmation dialog
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | undefined>();

  // Track the last created event ID for focus after modal cancel
  const [lastCreatedEventId, setLastCreatedEventId] = useState<
    string | undefined
  >();

  // Initialize IndexDB and load events
  useEffect(() => {
    const initializeDB = async () => {
      try {
        await indexDBAPI.init({
          dbName: "SchedulineDB",
          version: 1,
          stores: [
            {
              name: "events",
              keyPath: "id",
              indexes: [
                {
                  name: "day",
                  keyPath: "day",
                },
              ],
            },
          ],
        });

        // Load events from IndexDB
        const savedEvents = await indexDBAPI.readAll<CalendarEvent>("events");
        setEvents(savedEvents);
        setIsInitialized(true);
      } catch (error) {
        console.error("Failed to initialize IndexDB:", error);
        // Set some default events for development
        const defaultEvents: CalendarEvent[] = [
          {
            id: "1",
            day: 1,
            startHour: 9,
            duration: 2,
            title: "Team Meeting",
            color: "bg-indigo-500",
          },
          {
            id: "2",
            day: 3,
            startHour: 14,
            duration: 1,
            title: "Lunch",
            color: "bg-indigo-500",
          },
        ];
        setEvents(defaultEvents);
        setIsInitialized(true);
      }
    };

    initializeDB();
  }, []);

  // Focus on last created event when modal is closed
  useEffect(() => {
    if (creatingEvent === null && lastCreatedEventId) {
      // Find the created event to get its day
      const createdEvent = events.find((e) => e.id === lastCreatedEventId);
      if (createdEvent) {
        setDaySelected(true);
        setFocusedDay(createdEvent.day);
        setSelectedEventId(lastCreatedEventId);
        setLastCreatedEventId(undefined);
      }
    }
  }, [creatingEvent, lastCreatedEventId, events]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // track pressed key
      pressedKeysRef.current.add(e.key.toLowerCase());
      if (selectedSlot) {
        // Add Event Modal is open - only handle Escape, Enter
        if (e.key === "Escape") {
          setSelectedSlot(null);
          e.preventDefault();
        } else if (e.key === "Enter") {
          addEvent();
          e.preventDefault();
        }
        return;
      }

      if (creatingEvent) {
        // Creating event with [n] key - only handle Escape
        if (e.key === "Escape") {
          e.preventDefault();
          setCreatingEvent(null);
        }
        return;
      }

      if (editingDayIndex !== null) {
        // Edit Event Modal is open - only handle Escape
        if (e.key === "Escape") {
          e.preventDefault();
          setEditingDayIndex(null);
        }
        return;
      }

      if (daySelected && selectedEventId) {
        // Event selected - navigate between events and edit
        const dayEvents = events
          .filter((ev) => ev.day === focusedDay)
          .sort((a, b) => a.startHour - b.startHour);
        const currentIndex = dayEvents.findIndex(
          (ev) => ev.id === selectedEventId,
        );
        const currentEvent = dayEvents[currentIndex];
        if (!currentEvent) return;

        const key = e.key.toLowerCase();

        // Modifier behaviors: if holding 't' or 's' while pressing h/l
        if ((key === "h" || key === "l") && pressedKeysRef.current.has("t")) {
          e.preventDefault();
          // Move event start later by 30 minutes
          const ev = currentEvent;
          const delta = 0.5;
          let newStart = ev.startHour + delta;
          const maxStart = MAX_HOUR - ev.duration;
          if (newStart > maxStart) newStart = maxStart;
          // ensure not overlapping next event
          const next = dayEvents.find((o) => o.startHour > ev.startHour);
          if (next && newStart + ev.duration > next.startHour) {
            newStart = next.startHour - ev.duration;
          }
          if (newStart === ev.startHour) {
            toast.error("Cannot move start later (boundary or conflict)");
          } else {
            updateEvent({ ...ev, startHour: Math.round(newStart * 100) / 100 });
          }
          return;
        }

        if ((key === "h" || key === "l") && pressedKeysRef.current.has("s")) {
          e.preventDefault();
          // Shrink event end by 30 minutes (reduce duration)
          const ev = currentEvent;
          const newDuration = Math.round((ev.duration - 0.5) * 100) / 100;
          if (newDuration < 0.5) {
            toast.error("Cannot shorten event below 30 minutes");
          } else {
            updateEvent({ ...ev, duration: newDuration });
          }
          return;
        }

        // If time-adjust mode is active, handle extending earlier/later
        if (timeAdjustMode) {
          if (e.key === "h" || e.key === "H") {
            e.preventDefault();
            // extend earlier by up to 0.5 hours, bounded by MIN_HOUR and previous events
            const desiredStart = currentEvent.startHour - 0.5;
            // compute latest allowed start (can't overlap previous events)
            let latestAllowedStart = MIN_HOUR;
            for (const ev of dayEvents) {
              if (ev.id === currentEvent.id) break;
              latestAllowedStart = Math.max(
                latestAllowedStart,
                ev.startHour + ev.duration,
              );
            }
            const newStart = Math.max(latestAllowedStart, desiredStart);
            if (newStart === currentEvent.startHour) {
              toast.error("Cannot extend earlier (boundary or conflict)");
            } else {
              const newDuration = currentEvent.duration +
                (currentEvent.startHour - newStart);
              const updated = {
                ...currentEvent,
                startHour: newStart,
                duration: Math.round(newDuration * 100) / 100,
              };
              updateEvent(updated);
            }
            // keep timeAdjustMode true so multiple h/l presses can repeatedly extend
            return;
          } else if (e.key === "l" || e.key === "L") {
            e.preventDefault();
            // extend later by up to 0.5 hours, bounded by MAX_HOUR and next events
            const desiredEnd = currentEvent.startHour + currentEvent.duration + 0.5;
            const endLimit = MAX_HOUR;
            let earliestNextStart = endLimit;
            for (const ev of dayEvents) {
              if (ev.startHour <= currentEvent.startHour) continue;
              earliestNextStart = Math.min(earliestNextStart, ev.startHour);
            }
            const newEnd = Math.min(earliestNextStart, desiredEnd, endLimit);
            if (newEnd === currentEvent.startHour + currentEvent.duration) {
              toast.error("Cannot extend later (boundary or conflict)");
            } else {
              const newDuration = Math.round((newEnd - currentEvent.startHour) * 100) / 100;
              const updated = {
                ...currentEvent,
                duration: newDuration,
              };
              updateEvent(updated);
            }
            // keep timeAdjustMode true so multiple h/l presses can repeatedly extend
            return;
          } else {
            // any other key cancels the time adjust mode
            setTimeAdjustMode(false);
            return;
          }
        }

        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          if (currentIndex < dayEvents.length - 1) {
            setSelectedEventId(dayEvents[currentIndex + 1].id);
          }
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          if (currentIndex > 0) {
            setSelectedEventId(dayEvents[currentIndex - 1].id);
          }
        } else if (e.key === "d" || e.key === "D") {
          // d key to delete selected event
          e.preventDefault();
          setDeleteConfirmId(selectedEventId);
        } else if (e.key === " ") {
          // Space to edit selected event
          e.preventDefault();
          setEditingDayIndex(focusedDay);
        } else if (e.key === "n" || e.key === "N") {
          e.preventDefault();
          setCreatingEvent({ day: focusedDay, hour: 9, duration: 1 });
        } else if (e.key === "h" || e.key === "H") {
          // move event earlier by 0.5h with bounding
          e.preventDefault();
          const ev = currentEvent;
          let newStart = Math.max(ev.startHour - 0.5, MIN_HOUR);
          // ensure not overlapping previous event
          let prevEnd = MIN_HOUR;
          for (const o of dayEvents) {
            if (o.id === ev.id) break;
            prevEnd = Math.max(prevEnd, o.startHour + o.duration);
          }
          if (newStart < prevEnd) newStart = prevEnd;
          if (newStart === ev.startHour) {
            toast.error("Cannot move earlier (boundary or conflict)");
          } else {
            updateEvent({ ...ev, startHour: Math.round(newStart * 100) / 100 });
          }
        } else if (e.key === "l" || e.key === "L") {
          // move event later by 30 minutes with bounding
          e.preventDefault();
          const ev = currentEvent;
          const delta = 0.5; // 30 minutes in hours
          let newStart = ev.startHour + delta;
          const maxStart = MAX_HOUR - ev.duration;
          if (newStart > maxStart) newStart = maxStart;
          // ensure not overlapping next event
          const next = dayEvents.find((o) => o.startHour > ev.startHour);
          if (next && newStart + ev.duration > next.startHour) {
            newStart = next.startHour - ev.duration;
          }
          if (newStart === ev.startHour) {
            toast.error("Cannot move later (boundary or conflict)");
          } else {
            updateEvent({ ...ev, startHour: Math.round(newStart * 100) / 100 });
          }
        } else if (e.key === "j" || e.key === "J") {
          // move to next weekday
          e.preventDefault();
          const ev = currentEvent;
          const targetDay = (ev.day + 1) % 7;
          const conflicts = events.filter(
            (o) =>
              o.day === targetDay &&
              !(o.startHour + o.duration <= ev.startHour ||
                o.startHour >= ev.startHour + ev.duration),
          );
          if (conflicts.length > 0) {
            toast.error("Cannot move to next day: time conflict with existing event");
          } else {
            updateEvent({ ...ev, day: targetDay });
            // keep selection on moved event
            setFocusedDay(targetDay);
            setSelectedEventId(ev.id);
          }
        } else if (e.key === "k" || e.key === "K") {
          // move to previous weekday
          e.preventDefault();
          const ev = currentEvent;
          const targetDay = ev.day - 1 < 0 ? DAYS_OF_WEEK.length - 1 : ev.day - 1;
          const conflicts = events.filter(
            (o) =>
              o.day === targetDay &&
              !(o.startHour + o.duration <= ev.startHour ||
                o.startHour >= ev.startHour + ev.duration),
          );
          if (conflicts.length > 0) {
            toast.error("Cannot move to previous day: time conflict with existing event");
          } else {
            updateEvent({ ...ev, day: targetDay });
            setFocusedDay(targetDay);
            setSelectedEventId(ev.id);
          }
        } else if (e.key === "t" || e.key === "T") {
          // enter time-adjust mode: next h/l will extend earlier/later by 30 minutes
          e.preventDefault();
          setTimeAdjustMode(true);
        } else if (e.key === "Escape") {
          e.preventDefault();
          setSelectedEventId(undefined);
          setDaySelected(false);
        }
        return;
      }

      if (daySelected) {
        // Day selected but no event selected
        if (e.key === "n" || e.key === "N") {
          // 'n' key to create new event
          e.preventDefault();
          setCreatingEvent({ day: focusedDay, hour: 9, duration: 1 });
        } else if (e.key === "Escape") {
          e.preventDefault();
          setDaySelected(false);
        }
        return;
      }

      // Day navigation mode
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedDay((prev) => (prev + 1) % DAYS_OF_WEEK.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedDay((prev) =>
          prev - 1 < 0 ? DAYS_OF_WEEK.length - 1 : prev - 1,
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        setDaySelected(true);
        // Focus on first event (sorted by start time) if any, otherwise stay in day mode
        const dayEvents = events
          .filter((ev) => ev.day === focusedDay)
          .sort((a, b) => a.startHour - b.startHour);
        if (dayEvents.length > 0) {
          setSelectedEventId(dayEvents[0].id);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      pressedKeysRef.current.delete(e.key.toLowerCase());
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    focusedDay,
    selectedEventId,
    daySelected,
    events,
    selectedSlot,
    editingDayIndex,
    creatingEvent,
  ]);

  // Canvas interaction handlers
  const handleCanvasSelectDay = (dayIndex: number) => {
    setFocusedDay(dayIndex);
    setDaySelected(true);
    setSelectedEventId(undefined);
  };

  const handleCanvasSelectEvent = (eventId: string, dayIndex: number) => {
    setFocusedDay(dayIndex);
    setDaySelected(true);
    setSelectedEventId(eventId);
  };

  const handleCanvasSlotClick = (dayIndex: number, hour: number) => {
    setFocusedDay(dayIndex);
    setDaySelected(true);
    setSelectedEventId(undefined);
    setSelectedSlot({ day: dayIndex, hour });
  };

  const addEvent = async () => {
    if (!selectedSlot || !eventTitle.trim()) return;

    const newEvent: CalendarEvent = {
      id: Date.now().toString(),
      day: selectedSlot.day,
      startHour: selectedSlot.hour,
      duration: 1,
      title: eventTitle,
      color: "bg-indigo-500",
    };

    try {
      await indexDBAPI.create("events", newEvent);
      setEvents([...events, newEvent]);
      setEventTitle("");
      setSelectedSlot(null);

    } catch (error) {
      console.error("Failed to create event:", error);
      setEvents([...events, newEvent]);
      setEventTitle("");
      setSelectedSlot(null);

    }
  };

  const addEventFromDialog = async (
    title: string,
    day: number,
    hour: number,
    duration: number,
  ) => {
    if (!title.trim()) return;

    const newEvent: CalendarEvent = {
      id: Date.now().toString(),
      day,
      startHour: hour,
      duration,
      title,
      color: "bg-indigo-500",
    };

    try {
      await indexDBAPI.create("events", newEvent);
      setEvents([...events, newEvent]);
      setLastCreatedEventId(newEvent.id);
      setCreatingEvent(null);

    } catch (error) {
      console.error("Failed to create event:", error);
      setEvents([...events, newEvent]);
      setLastCreatedEventId(newEvent.id);
      setCreatingEvent(null);

    }
  };

  const deleteEvent = async (id: string) => {
    // Determine which event (if any) to focus after deletion
    const dayEvents = events
      .filter((ev) => ev.day === focusedDay)
      .sort((a, b) => a.startHour - b.startHour);
    const deletedIndex = dayEvents.findIndex((ev) => ev.id === id);
    const remaining = dayEvents.filter((ev) => ev.id !== id);
    const nextId =
      remaining.length > 0
        ? remaining[Math.min(deletedIndex, remaining.length - 1)].id
        : undefined;

    try {
      await indexDBAPI.delete("events", id);
      setEvents(events.filter((e) => e.id !== id));
      setSelectedEventId(nextId);
      setDaySelected(true);

    } catch (error) {
      console.error("Failed to delete event:", error);
      setEvents(events.filter((e) => e.id !== id));
      setSelectedEventId(nextId);
      setDaySelected(true);

    }
  };

  // Import
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importEvents = async (file: File) => {
    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);

      if (!Array.isArray(parsed)) {
        toast.error("Invalid file: expected a JSON array");
        return;
      }

      const valid: CalendarEvent[] = [];
      const invalid: number[] = [];

      (parsed as unknown[]).forEach((item, i) => {
        if (
          item !== null &&
          typeof item === "object" &&
          typeof (item as Record<string, unknown>).title === "string" &&
          typeof (item as Record<string, unknown>).day === "number" &&
          typeof (item as Record<string, unknown>).startHour === "number" &&
          typeof (item as Record<string, unknown>).duration === "number"
        ) {
          const ev = item as Record<string, unknown>;
          valid.push({
            id: `imported-${Date.now()}-${i}`,
            day: Math.max(0, Math.min(6, Math.round(ev.day as number))),
            startHour: ev.startHour as number,
            duration: Math.max(0.5, ev.duration as number),
            title: (ev.title as string).trim() || "(no title)",
            color: typeof ev.color === "string" ? ev.color : "bg-indigo-500",
          });
        } else {
          invalid.push(i);
        }
      });

      if (valid.length === 0) {
        toast.error("No valid events found in file");
        return;
      }

      // Persist each imported event to IndexDB
      for (const ev of valid) {
        try {
          await indexDBAPI.create("events", ev);
        } catch {
          // ignore individual write errors
        }
      }

      setEvents((prev) => [...prev, ...valid]);

      const skipped = invalid.length > 0 ? ` (${invalid.length} skipped)` : "";

    } catch {
      toast.error("Failed to parse JSON file");
    }
  };

  const updateEvent = async (updatedEvent: CalendarEvent) => {
    try {
      await indexDBAPI.update("events", updatedEvent);
      setEvents(
        events.map((e) => (e.id === updatedEvent.id ? updatedEvent : e)),
      );
      setEditingDayIndex(null);

    } catch (error) {
      console.error("Failed to update event:", error);
      setEvents(
        events.map((e) => (e.id === updatedEvent.id ? updatedEvent : e)),
      );
      setEditingDayIndex(null);

    }
  };

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-slate-300">Loading calendar...</p>
      </div>
    );
  }

  return (
    <div className="max-w-full mx-auto">
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

      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Calendar</h2>
      </div>

      {/* Add Event Modal (from hour click) */}
      {selectedSlot && (
        <AddEventModal
          slot={selectedSlot}
          day={DAYS_OF_WEEK[selectedSlot.day]}
          hour={selectedSlot.hour}
          title={eventTitle}
          onTitleChange={setEventTitle}
          onSave={addEvent}
          onCancel={() => {
            setSelectedSlot(null);
            setEventTitle("");
          }}
        />
      )}

      {/* Create Event Modal (from [n] key) */}
      {creatingEvent && (
        <CreateEventModal
          day={creatingEvent.day}
          dayName={DAYS_OF_WEEK[creatingEvent.day]}
          hour={creatingEvent.hour}
          duration={creatingEvent.duration}
          days={DAYS_OF_WEEK}
          onSave={addEventFromDialog}
          onCancel={() => setCreatingEvent(null)}
        />
      )}

      {/* Edit Event Modal */}
      {editingDayIndex !== null && selectedEventId && (
        <EditEventModal
          event={events.find((e) => e.id === selectedEventId)!}
          days={DAYS_OF_WEEK}
          onSave={updateEvent}
          onCancel={() => setEditingDayIndex(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <DeleteConfirmDialog
          eventId={deleteConfirmId}
          eventTitle={
            events.find((e) => e.id === deleteConfirmId)?.title || "Event"
          }
          onConfirm={(id) => {
            deleteEvent(id);
            setDeleteConfirmId(undefined);
          }}
          onCancel={() => setDeleteConfirmId(undefined)}
        />
      )}

      {/* Canvas Calendar Grid */}
      <CanvasCalendarGrid
        days={DAYS_OF_WEEK}
        events={events}
        focusedDay={focusedDay}
        daySelected={daySelected}
        selectedEventId={daySelected ? selectedEventId : undefined}
        onSelectDay={handleCanvasSelectDay}
        onSelectEvent={handleCanvasSelectEvent}
        onSlotClick={handleCanvasSlotClick}
      />

      {/* Info */}
      <div className="mt-6 p-4 bg-slate-900 border border-slate-700">
        <div className="text-sm text-slate-300 space-y-1">
          <p>
            <strong>Keyboard:</strong> ↑/↓ days, Enter select, n new, space edit, d delete, h -30min, l +3min, j next day, k prev day, t then h/l extend by 30min
          </p>
          <p className="text-slate-400 text-xs mt-2">
            Arrow keys navigate events, Esc to go back. On moving/creating events, conflicts with existing events will be reported.
          </p>
          <p className="text-slate-400 text-xs mt-2">
            {events.length} event{events.length !== 1 ? "s" : ""} scheduled
          </p>
        </div>
      </div>

      {/* Import / Export Section */}
      <div className="mt-4 p-4 bg-slate-900 border border-slate-700">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-white mb-1">
              Import / Export
            </h3>
            <p className="text-xs text-slate-400">
              Import merges with existing events. Export saves all as JSON.
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-colors"
            >
              Import JSON
            </button>
            <button
              onClick={() => exportEvents(events)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
            >
              Export JSON
            </button>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              importEvents(file);
              e.target.value = "";
            }
          }}
        />
      </div>
    </div>
  );
}

interface AddEventModalProps {
  slot: { day: number; hour: number };
  day: string;
  hour: number;
  title: string;
  onTitleChange: (title: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

function AddEventModal({
  day,
  hour,
  title,
  onTitleChange,
  onSave,
  onCancel,
}: AddEventModalProps) {
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onSave();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-700 p-6 w-96 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Add Event</h3>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-slate-800 transition-colors"
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Day: {day}
            </label>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Time: {formatHour(hour)}
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Event Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter event title"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              autoFocus
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
            >
              Add Event
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface CreateEventModalProps {
  day: number;
  dayName: string;
  hour: number;
  duration: number;
  days: string[];
  onSave: (title: string, day: number, hour: number, duration: number) => void;
  onCancel: () => void;
}

function CreateEventModal({
  dayName,
  hour,
  duration,
  day,
  days,
  onSave,
  onCancel,
}: CreateEventModalProps) {
  const [title, setTitle] = useState("");
  const [selectedDay, setSelectedDay] = useState(day);
  const [selectedHour, setSelectedHour] = useState(hour);
  const [selectedDuration, setSelectedDuration] = useState(duration);

  const handleSave = () => {
    onSave(title, selectedDay, selectedHour, selectedDuration);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
      handleSave();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-700 p-6 w-96 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Create Event</h3>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-slate-800 transition-colors"
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Event Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter event title"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Day
              </label>
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(Number(e.target.value))}
                onKeyPress={handleKeyPress}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 text-white focus:outline-none focus:border-indigo-500"
              >
                {days.map((d, i) => (
                  <option key={i} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Start Hour
              </label>
              <select
                value={selectedHour}
                onChange={(e) => setSelectedHour(Number(e.target.value))}
                onKeyPress={handleKeyPress}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 text-white focus:outline-none focus:border-indigo-500"
              >
                {TIME_SLOTS.map((h) => (
                  <option key={h} value={h}>
                    {formatHour(h)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Duration (hours)
            </label>
            <select
              value={selectedDuration}
              onChange={(e) => setSelectedDuration(Number(e.target.value))}
              onKeyPress={handleKeyPress}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 text-white focus:outline-none focus:border-indigo-500"
            >
              {Array.from(
                {
                  length: Math.max(
                    1,
                    Math.floor((MAX_HOUR - selectedHour) / 0.5),
                  ),
                },
                (_, i) => (i + 1) * 0.5,
              ).map((d) => (
                <option key={d} value={d}>
                  {d === 0.5 ? "30 min" : `${d} hour${d > 1 ? "s" : ""}`}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
            >
              Create Event
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface EditEventModalProps {
  event: CalendarEvent;
  days: string[];
  onSave: (event: CalendarEvent) => void;
  onCancel: () => void;
}

function EditEventModal({
  event,
  days,
  onSave,
  onCancel,
}: EditEventModalProps) {
  const [title, setTitle] = useState(event.title);
  const [day, setDay] = useState(event.day);
  const [hour, setHour] = useState(event.startHour);
  const [duration, setDuration] = useState(event.duration);

  const handleSave = () => {
    onSave({
      ...event,
      title,
      day,
      startHour: hour,
      duration,
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
      handleSave();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-700 p-6 w-96 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Edit Event</h3>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-slate-800 transition-colors"
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyPress={handleKeyPress}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Day
              </label>
              <select
                value={day}
                onChange={(e) => setDay(Number(e.target.value))}
                onKeyPress={handleKeyPress}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 text-white focus:outline-none focus:border-indigo-500"
              >
                {days.map((d, i) => (
                  <option key={i} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Start Hour
              </label>
              <select
                value={hour}
                onChange={(e) => setHour(Number(e.target.value))}
                onKeyPress={handleKeyPress}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 text-white focus:outline-none focus:border-indigo-500"
              >
                {TIME_SLOTS.map((h) => (
                  <option key={h} value={h}>
                    {formatHour(h)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Duration (hours)
            </label>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              onKeyPress={handleKeyPress}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 text-white focus:outline-none focus:border-indigo-500"
            >
              {Array.from(
                { length: Math.max(1, Math.floor((MAX_HOUR - hour) / 0.5)) },
                (_, i) => (i + 1) * 0.5,
              ).map((d) => (
                <option key={d} value={d}>
                  {d === 0.5 ? "30 min" : `${d} hour${d > 1 ? "s" : ""}`}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface DeleteConfirmDialogProps {
  eventId: string;
  eventTitle: string;
  onConfirm: (id: string) => void;
  onCancel: () => void;
}

function DeleteConfirmDialog({
  eventId,
  eventTitle,
  onConfirm,
  onCancel,
}: DeleteConfirmDialogProps) {
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onConfirm(eventId);
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-700 p-6 w-96 shadow-lg">
        <h3 className="text-lg font-semibold text-white mb-4">Delete Event?</h3>
        <p className="text-slate-300 mb-6">
          Are you sure you want to delete "<strong>{eventTitle}</strong>"?
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            onKeyDown={handleKeyPress}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            autoFocus
          >
            Cancel (Esc)
          </button>
          <button
            onClick={() => onConfirm(eventId)}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white transition-colors"
          >
            Delete (Enter)
          </button>
        </div>
      </div>
    </div>
  );
}

const exportEvents = (eventsList: CalendarEvent[]) => {
  const dataStr = JSON.stringify(eventsList, null, 2);
  const dataBlob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `scheduline-events-${new Date().toISOString().split("T")[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

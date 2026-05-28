import { useState, useEffect } from "react";
import { X } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { DayColumn } from "../components/Calendar/DayColumn";
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

const MIN_HOUR = 5;
const MAX_HOUR = 22;
const EVENT_HOURS = Array.from(
  { length: (MAX_HOUR - MIN_HOUR) * 2 + 1 },
  (_, i) => MIN_HOUR + i * 0.5,
);

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

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    focusedDay,
    selectedEventId,
    daySelected,
    events,
    selectedSlot,
    editingDayIndex,
    creatingEvent,
  ]);

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
      toast.success("Event created successfully");
    } catch (error) {
      console.error("Failed to create event:", error);
      setEvents([...events, newEvent]);
      setEventTitle("");
      setSelectedSlot(null);
      toast.success("Event created successfully");
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
      toast.success("Event created successfully");
    } catch (error) {
      console.error("Failed to create event:", error);
      setEvents([...events, newEvent]);
      setLastCreatedEventId(newEvent.id);
      setCreatingEvent(null);
      toast.success("Event created successfully");
    }
  };

  const deleteEvent = async (id: string) => {
    try {
      await indexDBAPI.delete("events", id);
      setEvents(events.filter((e) => e.id !== id));
      setSelectedEventId(undefined);
      toast.success("Event deleted successfully");
    } catch (error) {
      console.error("Failed to delete event:", error);
      setEvents(events.filter((e) => e.id !== id));
      setSelectedEventId(undefined);
      toast.success("Event deleted successfully");
    }
  };

  const updateEvent = async (updatedEvent: CalendarEvent) => {
    try {
      await indexDBAPI.update("events", updatedEvent);
      setEvents(
        events.map((e) => (e.id === updatedEvent.id ? updatedEvent : e)),
      );
      setEditingDayIndex(null);
      toast.success("Event updated successfully");
    } catch (error) {
      console.error("Failed to update event:", error);
      setEvents(
        events.map((e) => (e.id === updatedEvent.id ? updatedEvent : e)),
      );
      setEditingDayIndex(null);
      toast.success("Event updated successfully");
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

      {/* Hour Headers */}
      <div className="overflow-x-auto pb-4">
        <div className="flex">
          <div className="w-29 flex-shrink-0" />
          <div className="flex gap-0">
            {Array.from({ length: 36 }, (_, i) => MIN_HOUR + i * 0.5).map(
              (slot) =>
                slot % 1 === 0 && (
                  <div
                    key={slot}
                    className={
                      "w-20 flex-shrink-0 text-center font-semibold text-slate-400 text-xs py-2 border-b border-slate-700"
                    }
                  >
                    {`${String(Math.floor(slot)).padStart(2, "0")}:00`}
                  </div>
                ),
            )}
          </div>
        </div>

        {/* Days Grid */}
        <div>
          {DAYS_OF_WEEK.map((day, dayIndex) => (
            <DayColumn
              key={day}
              dayName={day}
              dayIndex={dayIndex}
              events={events}
              isFocused={focusedDay === dayIndex}
              daySelected={daySelected && focusedDay === dayIndex}
              selectedEventId={
                daySelected && focusedDay === dayIndex
                  ? selectedEventId
                  : undefined
              }
            />
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="mt-6 p-4 bg-slate-900 border border-slate-700">
        <div className="text-sm text-slate-300 space-y-1">
          <p>
            <strong>Keyboard:</strong> ↑↓ days, enter select, n new, space edit,
            d delete
          </p>
          <p className="text-slate-400 text-xs mt-2">
            arrow navigate events, esc back
          </p>
          <p className="text-slate-400 text-xs mt-2">
            {events.length} event{events.length !== 1 ? "s" : ""} scheduled
          </p>
        </div>
      </div>

      {/* Export Section */}
      <div className="mt-4 p-4 bg-slate-900 border border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white mb-1">
              Export Events
            </h3>
            <p className="text-xs text-slate-400">
              Download all events as JSON file
            </p>
          </div>
          <button
            onClick={() => exportEvents(events)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
          >
            Export JSON
          </button>
        </div>
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
                {EVENT_HOURS.map((h) => (
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
              {Array.from({ length: 16 }, (_, i) => (i + 1) * 0.5).map((d) => (
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
                {EVENT_HOURS.map((h) => (
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
              {Array.from({ length: 16 }, (_, i) => (i + 1) * 0.5).map((d) => (
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
  toast.success("Events exported successfully");
};

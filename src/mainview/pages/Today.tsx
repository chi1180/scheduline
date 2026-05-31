import { useEffect, useMemo, useState } from "react";
import { indexDBAPI, type IDBConfig } from "../utils/indexDBAPI";
import type { CalendarEvent } from "./Calendar";

interface TodayNoteRecord {
  id: string;
  date: string;
  eventId: string;
  eventTitle: string;
  content: string;
  updatedAt: string;
}

const DB_CONFIG: IDBConfig = {
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
    {
      name: "today-notes",
      keyPath: "id",
      indexes: [
        {
          name: "dateIndex",
          keyPath: "date",
        },
      ],
    },
  ],
};

const formatTime = (value: number) => {
  const hour = Math.floor(value);
  const minute = Math.round((value - hour) * 60);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

const getLocalDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getNowHour = (date: Date) => date.getHours() + date.getMinutes() / 60;

const getInitialEvent = (events: CalendarEvent[], nowHour: number) => {
  if (events.length === 0) return undefined;

  const current = events.find(
    (event) => event.startHour <= nowHour && nowHour < event.startHour + event.duration,
  );
  if (current) return current;

  const upcoming = events.find((event) => event.startHour > nowHour);
  return upcoming ?? events[events.length - 1];
};

const buildNoteId = (dateKey: string, eventId: string) => `${dateKey}:${eventId}`;

export default function Today() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>();
  const [note, setNote] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingNote, setIsLoadingNote] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        await indexDBAPI.init(DB_CONFIG);
        const savedEvents = await indexDBAPI.readAll<CalendarEvent>("events");
        setEvents(savedEvents);
      } catch (error) {
        console.error("Failed to initialize Today page:", error);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, []);

  useEffect(() => {
    const update = () => setNow(new Date());
    update();

    let intervalId: number | undefined;
    const timeoutId = window.setTimeout(() => {
      update();
      intervalId = window.setInterval(update, 60_000);
    }, 60_000 - new Date().getSeconds() * 1000 - new Date().getMilliseconds());

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  const todayIndex = now.getDay();
  const todayKey = useMemo(() => getLocalDateKey(now), [now]);

  const todayEvents = useMemo(
    () =>
      events
        .filter((event) => event.day === todayIndex)
        .sort((a, b) => a.startHour - b.startHour),
    [events, todayIndex],
  );

  const selectedEvent = useMemo(
    () => todayEvents.find((event) => event.id === selectedEventId),
    [todayEvents, selectedEventId],
  );

  useEffect(() => {
    if (todayEvents.length === 0) {
      setSelectedEventId(undefined);
      return;
    }

    setSelectedEventId((prev) => {
      if (prev && todayEvents.some((event) => event.id === prev)) {
        return prev;
      }

      const initialEvent = getInitialEvent(todayEvents, getNowHour(now));
      return initialEvent?.id;
    });
  }, [todayEvents, now]);

  useEffect(() => {
    let cancelled = false;

    const loadNote = async () => {
      if (!selectedEvent) {
        setNote("");
        setSaveState("idle");
        return;
      }

      setIsLoadingNote(true);
      try {
        const noteId = buildNoteId(todayKey, selectedEvent.id);
        const record = await indexDBAPI.read<TodayNoteRecord>("today-notes", noteId);
        if (cancelled) return;
        setNote(record?.content ?? "");
        setSaveState("idle");
      } catch (error) {
        console.error("Failed to load note:", error);
        if (!cancelled) {
          setNote("");
          setSaveState("error");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingNote(false);
        }
      }
    };

    loadNote();

    return () => {
      cancelled = true;
    };
  }, [selectedEvent?.id, todayKey, selectedEvent]);

  const persistNote = async (content: string, event: CalendarEvent) => {
    setSaveState("saving");
    try {
      const record: TodayNoteRecord = {
        id: buildNoteId(todayKey, event.id),
        date: todayKey,
        eventId: event.id,
        eventTitle: event.title,
        content,
        updatedAt: new Date().toISOString(),
      };
      await indexDBAPI.update("today-notes", record);
      setSaveState("saved");
    } catch (error) {
      console.error("Failed to save note:", error);
      setSaveState("error");
    }
  };

  const handleNoteChange = (value: string) => {
    setNote(value);
    if (selectedEvent) {
      void persistNote(value, selectedEvent);
    }
  };

  const nowHour = getNowHour(now);
  const activeEvent = todayEvents.find(
    (event) => event.startHour <= nowHour && nowHour < event.startHour + event.duration,
  );
  const nextEventIndex =
    activeEvent ? -1 : todayEvents.findIndex((event) => event.startHour > nowHour);
  const nowInsertIndex =
    activeEvent || todayEvents.length === 0
      ? -1
      : nextEventIndex === -1
        ? todayEvents.length
        : nextEventIndex;

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto text-slate-300">
        <p>Loading today...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <p className="text-center text-app-secondary">
        Write you mind as a <strong>note</strong>, as a <strong>keep</strong>,
        as a foot print of your <strong>efforts</strong>_
      </p>

      <div className="mt-6 flex gap-4 min-h-[70vh]">
        <section className="flex-1 border border-slate-700 bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
            <div>
              <h3 className="text-lg font-semibold text-white">Today</h3>
              <p className="text-xs text-slate-400">
                {todayEvents.length} event{todayEvents.length !== 1 ? "s" : ""} scheduled
              </p>
            </div>
            <div className="text-right text-xs text-slate-400">
              <div>{getLocalDateKey(now)}</div>
              <div>{formatTime(nowHour)}</div>
            </div>
          </div>

          <div className="divide-y divide-slate-800">
            {todayEvents.length === 0 ? (
              <div className="p-6 text-sm text-slate-400">No events scheduled for today.</div>
            ) : (
              todayEvents.map((event, index) => (
                <div key={event.id}>
                  {nowInsertIndex === index && (
                    <div className="flex items-center gap-3 border-b border-dashed border-red-700 bg-red-950/30 px-4 py-3 text-sm text-red-200">
                      <span className="rounded border border-red-700 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide">
                        Now
                      </span>
                      <span>{formatTime(nowHour)}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedEventId(event.id)}
                    className={`w-full px-4 py-4 text-left transition-colors ${
                      selectedEventId === event.id
                        ? "bg-indigo-950/60"
                        : "hover:bg-slate-800/70"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-white">
                          {event.title}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          {formatTime(event.startHour)} -{" "}
                          {formatTime(event.startHour + event.duration)}
                        </div>
                      </div>
                      {selectedEventId === event.id && (
                        <span className="rounded bg-indigo-600 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                          Selected
                        </span>
                      )}
                    </div>
                  </button>

                  {activeEvent?.id === event.id && (
                    <div className="border-t border-dashed border-red-700 bg-red-950/30 px-4 py-3 text-sm text-red-200">
                      <span className="mr-2 rounded border border-red-700 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide">
                        Now
                      </span>
                      <span>{formatTime(nowHour)}</span>
                    </div>
                  )}
                </div>
              ))
            )}

            {nowInsertIndex === todayEvents.length && todayEvents.length > 0 && (
              <div className="flex items-center gap-3 border-t border-dashed border-red-700 bg-red-950/30 px-4 py-3 text-sm text-red-200">
                <span className="rounded border border-red-700 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide">
                  Now
                </span>
                <span>{formatTime(nowHour)}</span>
              </div>
            )}
          </div>
        </section>

        <aside className="w-[360px] shrink-0 border border-slate-700 bg-slate-900 p-4">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-white">Note</h3>
            <p className="text-xs text-slate-400">
              {selectedEvent ? selectedEvent.title : "Select an event"}
            </p>
          </div>

          <textarea
            value={note}
            onChange={(e) => handleNoteChange(e.target.value)}
            disabled={!selectedEvent}
            placeholder="Write today's note here..."
            className="min-h-[420px] w-full resize-none border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
          />

          <div className="mt-3 text-xs text-slate-400">
            {isLoadingNote
              ? "Loading note..."
              : saveState === "saving"
                ? "Saving..."
                : saveState === "error"
                  ? "Save failed"
                  : "Saved"}
          </div>
        </aside>
      </div>
    </div>
  );
}

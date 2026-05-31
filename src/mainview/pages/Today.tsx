import { useEffect, useMemo, useRef, useState } from "react";
import { indexDBAPI, type IDBConfig } from "../utils/indexDBAPI";
import {
  MAX_HOUR,
  MIN_HOUR,
  SLOT_INTERVAL_HOURS,
} from "../components/Calendar/timeGrid";
import { TagFilterBar } from "../components/TagFilterBar";
import type { CalendarEvent } from "./Calendar";
import {
  collectTags,
  eventMatchesTagFilters,
  normalizeTags,
} from "../utils/eventTags";

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
    (event) =>
      event.startHour <= nowHour && nowHour < event.startHour + event.duration,
  );
  if (current) return current;

  const upcoming = events.find((event) => event.startHour > nowHour);
  return upcoming ?? events[events.length - 1];
};

const buildNoteId = (dateKey: string, eventId: string) =>
  `${dateKey}:${eventId}`;

const TIMELINE_SLOT_HEIGHT = 28;
const TIMELINE_LABEL_WIDTH = 72;

export default function Today() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>();
  const [focusMode, setFocusMode] = useState<"timeline" | "note" | null>(null);
  const [note, setNote] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingNote, setIsLoadingNote] = useState(false);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [tagFilters, setTagFilters] = useState<Record<string, boolean>>({});
  const [now, setNow] = useState(() => new Date());
  const timelineBodyRef = useRef<HTMLDivElement>(null);
  const [timelineBodyHeight, setTimelineBodyHeight] = useState(0);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const eventRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        console.log("[Today] init start");
        await indexDBAPI.init(DB_CONFIG);
        console.log("[Today] db init ok");
        const savedEvents = await indexDBAPI.readAll<CalendarEvent>("events");
        console.log("[Today] events loaded", {
          count: savedEvents.length,
          ids: savedEvents.map((event) => event.id),
        });
        setEvents(
          savedEvents.map((event) => ({
            ...event,
            tags: normalizeTags(event.tags),
          })),
        );
      } catch (error) {
        console.error("[Today] failed to initialize or load events:", error);
      } finally {
        console.log("[Today] init complete");
        setIsLoading(false);
      }
    };

    init();
  }, []);

  useEffect(() => {
    const update = () => setNow(new Date());
    update();

    let intervalId: number | undefined;
    const timeoutId = window.setTimeout(
      () => {
        update();
        intervalId = window.setInterval(update, 60_000);
      },
      60_000 - new Date().getSeconds() * 1000 - new Date().getMilliseconds(),
    );

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  const todayIndex = now.getDay();
  const todayKey = useMemo(() => getLocalDateKey(now), [now]);
  const allTags = useMemo(() => collectTags(events), [events]);

  useEffect(() => {
    setTagFilters((prev) => {
      const next: Record<string, boolean> = {};
      for (const tag of allTags) {
        next[tag] = prev[tag] ?? true;
      }
      return next;
    });
  }, [allTags]);

  const visibleEvents = useMemo(
    () => events.filter((event) => eventMatchesTagFilters(event, tagFilters)),
    [events, tagFilters],
  );

  const todayEvents = useMemo(
    () =>
      visibleEvents
        .filter((event) => event.day === todayIndex)
        .sort((a, b) => a.startHour - b.startHour),
    [visibleEvents, todayIndex],
  );

  const selectedEvent = useMemo(
    () => todayEvents.find((event) => event.id === selectedEventId),
    [todayEvents, selectedEventId],
  );
  const selectedEventTags = useMemo(
    () => normalizeTags(selectedEvent?.tags),
    [selectedEvent?.tags],
  );

  const focusTimeline = () => {
    setFocusMode("timeline");
    const targetId = selectedEventId ?? todayEvents[0]?.id;
    if (targetId) {
      setSelectedEventId(targetId);
      window.setTimeout(() => eventRefs.current[targetId]?.focus(), 0);
    }
  };

  const focusNote = () => {
    setFocusMode("note");
    window.setTimeout(() => noteRef.current?.focus(), 0);
  };

  useEffect(() => {
    if (todayEvents.length === 0) {
      console.log("[Today] no events for today", { todayIndex, todayKey });
      setSelectedEventId(undefined);
      return;
    }

    setSelectedEventId((prev) => {
      if (prev && todayEvents.some((event) => event.id === prev)) {
        console.log("[Today] keep selected event", { selectedEventId: prev });
        return prev;
      }

      const initialEvent = getInitialEvent(todayEvents, getNowHour(now));
      console.log("[Today] select initial event", {
        nowHour: getNowHour(now),
        selectedEventId: initialEvent?.id,
        eventIds: todayEvents.map((event) => event.id),
      });
      return initialEvent?.id;
    });
  }, [todayEvents, now]);

  useEffect(() => {
    if (focusMode === "timeline" && selectedEventId) {
      window.setTimeout(() => eventRefs.current[selectedEventId]?.focus(), 0);
    }
  }, [focusMode, selectedEventId]);

  useEffect(() => {
    if (selectedEventId && focusMode === null) {
      focusTimeline();
    }
  }, [selectedEventId, focusMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isNoteFocused = activeElement === noteRef.current;

      if (isNoteFocused) {
        if (e.key === "Escape") {
          e.preventDefault();
          noteRef.current?.blur();
          focusTimeline();
        }
        return;
      }

      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        focusNote();
        return;
      }

      if (focusMode === "timeline" && selectedEventId) {
        const currentIndex = todayEvents.findIndex(
          (event) => event.id === selectedEventId,
        );
        if (e.key === "Enter") {
          e.preventDefault();
          focusNote();
          return;
        }
        if (e.key === "j" || e.key === "J") {
          e.preventDefault();
          if (currentIndex < todayEvents.length - 1) {
            setSelectedEventId(todayEvents[currentIndex + 1].id);
          }
        } else if (e.key === "k" || e.key === "K") {
          e.preventDefault();
          if (currentIndex > 0) {
            setSelectedEventId(todayEvents[currentIndex - 1].id);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusMode, selectedEventId, todayEvents]);

  useEffect(() => {
    let cancelled = false;

    const loadNote = async () => {
      if (!selectedEvent) {
        console.log("[Today] note cleared - no selected event");
        setNote("");
        setSaveState("idle");
        return;
      }

      setIsLoadingNote(true);
      try {
        const noteId = buildNoteId(todayKey, selectedEvent.id);
        console.log("[Today] load note", {
          noteId,
          eventId: selectedEvent.id,
          date: todayKey,
        });
        const record = await indexDBAPI.read<TodayNoteRecord>(
          "today-notes",
          noteId,
        );
        console.log("[Today] note loaded", {
          noteId,
          found: !!record,
          contentLength: record?.content.length ?? 0,
        });
        if (cancelled) return;
        setNote(record?.content ?? "");
        setSaveState("idle");
      } catch (error) {
        console.error("[Today] failed to load note:", error);
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
      console.log("[Today] save note", {
        noteId: record.id,
        eventId: event.id,
        contentLength: content.length,
      });
      const existing = await indexDBAPI.read<TodayNoteRecord>(
        "today-notes",
        record.id,
      );
      if (existing) {
        await indexDBAPI.update("today-notes", record);
      } else {
        await indexDBAPI.create("today-notes", record);
      }
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
  const timelineSlots = useMemo(
    () =>
      Array.from(
        { length: (MAX_HOUR - MIN_HOUR) / SLOT_INTERVAL_HOURS },
        (_, index) => MIN_HOUR + index * SLOT_INTERVAL_HOURS,
      ),
    [],
  );
  const slotHeight =
    timelineBodyHeight > 0
      ? timelineBodyHeight / timelineSlots.length
      : TIMELINE_SLOT_HEIGHT;
  const timelineHeight = timelineSlots.length * slotHeight;
  const nowLineTop = ((nowHour - MIN_HOUR) / SLOT_INTERVAL_HOURS) * slotHeight;

  useEffect(() => {
    const measure = () => {
      if (timelineBodyRef.current) {
        setTimelineBodyHeight(timelineBodyRef.current.clientHeight);
      }
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto text-slate-300">
        <p>Loading today...</p>
      </div>
    );
  }

  return (
    <div className="w-[calc(100vw-6rem)] mx-auto h-[calc(100vh-6rem)] flex flex-col overflow-hidden">
      <p className="text-center text-app-secondary mb-2">
        Write you mind as a <strong>note</strong>, as a <strong>keep</strong>,
        as a foot print of your <strong>efforts</strong>_
      </p>

      <TagFilterBar
        tags={allTags}
        tagFilters={tagFilters}
        onToggle={(tag, checked) =>
          setTagFilters((prev) => ({ ...prev, [tag]: checked }))
        }
      />

      <div className="mt-2 flex flex-1 min-h-0 gap-4 overflow-hidden">
        <section className="flex flex-[1] min-h-0 flex-col border border-slate-700 bg-slate-900">
          <div className="border-b border-slate-700 px-4 py-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Timeline</h3>
                <p className="text-xs text-slate-400">30 minute increments</p>
              </div>
              <div className="text-right text-xs text-slate-400">
                <div>
                  {todayEvents.length} event
                  {todayEvents.length !== 1 ? "s" : ""}
                </div>
                <div>{formatTime(nowHour)}</div>
              </div>
            </div>
          </div>

          <div
            ref={timelineBodyRef}
            className="relative flex-1 min-h-0 overflow-hidden"
          >
            <div className="relative h-full" style={{ height: timelineHeight }}>
              <div
                className="absolute inset-y-0 left-0 border-r border-slate-700"
                style={{ width: TIMELINE_LABEL_WIDTH }}
              >
                {timelineSlots.map((slot) => {
                  const slotOffset =
                    ((slot - MIN_HOUR) / SLOT_INTERVAL_HOURS) * slotHeight;
                  const minute = Math.round((slot - Math.floor(slot)) * 60);

                  return minute === 0 ? (
                    <div
                      key={slot}
                      className="absolute left-0 flex items-center pr-2 text-[10px] text-slate-400"
                      style={{ top: slotOffset - 6, height: slotHeight }}
                    >
                      <span className="w-full text-right">
                        {String(Math.floor(slot)).padStart(2, "0")}:00
                      </span>
                    </div>
                  ) : null;
                })}
              </div>

              <div
                className="absolute inset-y-0"
                style={{ left: TIMELINE_LABEL_WIDTH, right: 0 }}
              >
                {timelineSlots.map((slot, index) => (
                  <div
                    key={slot}
                    className={`absolute left-0 right-0 border-t ${
                      index % 2 === 0
                        ? "border-slate-800"
                        : "border-slate-800/60"
                    }`}
                    style={{
                      top: index * slotHeight,
                      height: slotHeight,
                    }}
                  />
                ))}

                {!todayEvents.length && (
                  <div className="absolute left-0 top-4 px-4 text-sm text-slate-400">
                    No events scheduled for today.
                  </div>
                )}

                {todayEvents.map((event) => {
                  return (
                    <button
                      key={event.id}
                      type="button"
                      ref={(el) => {
                        eventRefs.current[event.id] = el;
                      }}
                      onClick={() => {
                        setSelectedEventId(event.id);
                        setFocusMode("timeline");
                      }}
                      onFocus={() => setFocusMode("timeline")}
                      className={`absolute left-2 right-2 px-3 py-2 text-left ${
                        selectedEventId === event.id
                          ? "border border-indigo-500 bg-indigo-950/60 shadow-lg shadow-indigo-950/30"
                          : "border border-slate-700 bg-slate-800/80 hover:border-indigo-500 hover:bg-slate-800"
                      }`}
                      style={{
                        top:
                          ((event.startHour - MIN_HOUR) / SLOT_INTERVAL_HOURS) *
                          slotHeight,
                        height:
                          (event.duration / SLOT_INTERVAL_HOURS) * slotHeight,
                      }}
                    >
                    <div className="text-xs font-medium text-white">
                      {event.title}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-400">
                      {formatTime(event.startHour)} -{" "}
                      {formatTime(event.startHour + event.duration)}
                      </div>
                    </button>
                  );
                })}

                {nowHour >= MIN_HOUR && nowHour <= MAX_HOUR && (
                  <div
                    className="absolute left-0 right-0 h-px bg-red-500"
                    style={{ top: nowLineTop }}
                  />
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-[2] min-h-0 flex-col border border-slate-700 bg-slate-900 p-4">
          <div className="mb-4 flex items-start justify-between gap-4 border-b border-slate-700 pb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Note</h3>
              <p className="text-xs text-slate-400">
                {selectedEvent ? selectedEvent.title : "Select an event"}
              </p>
              {selectedEventTags.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-slate-300">
                  {selectedEventTags.map((tag) => (
                    <span key={tag}>{`#${tag}`}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="text-right text-xs text-slate-400">
              <div>{getLocalDateKey(now)}</div>
              <div>{formatTime(nowHour)}</div>
            </div>
          </div>

          <textarea
            ref={noteRef}
            value={note}
            onChange={(e) => handleNoteChange(e.target.value)}
            disabled={!selectedEvent}
            onFocus={() => setFocusMode("note")}
            onBlur={() => {
              if (focusMode === "note") {
                setFocusMode(null);
              }
            }}
            placeholder="Write today's note here..."
            className="flex-1 min-h-0 w-full resize-none border border-slate-700 bg-slate-950 px-4 py-4 text-sm text-slate-100 outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
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
        </section>
      </div>

      <div className="mt-4 shrink-0 border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-300">
        <strong>Keyboard:</strong> enter focus note, j/k move timeline event, n
        focus note, esc return to timeline
      </div>
    </div>
  );
}

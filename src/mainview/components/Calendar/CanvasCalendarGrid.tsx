import React, { useEffect, useRef, useState } from "react";
import { Layer, Line, Rect, Stage, Text } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { CalendarEvent } from "../../pages/Calendar";
import { formatTags } from "../../utils/eventTags";
import {
  HOUR_LABELS,
  MIN_HOUR,
  MAX_HOUR,
  SLOT_INTERVAL_HOURS,
  TIME_SLOTS,
} from "./timeGrid";

const LABEL_WIDTH = 112;
const HEADER_HEIGHT = 32;
const ROW_HEIGHT = 96;
const EVENT_PADDING = 8;
const EVENT_HEIGHT = ROW_HEIGHT - EVENT_PADDING * 2;

const COLORS = {
  background: "rgb(2, 6, 23)",
  headerBackground: "rgb(15, 23, 42)",
  labelBackground: "rgb(15, 23, 42)",
  labelBackgroundFocused: "rgb(30, 41, 59)",
  labelBackgroundSelected: "rgb(49, 46, 129)",
  hourLabelBackground: "rgb(15, 23, 42)",
  hourLabelBackgroundAlt: "rgb(30, 41, 59)",
  labelText: "rgb(203, 213, 225)",
  labelTextFocused: "rgb(199, 210, 254)",
  labelTextSelected: "#ffffff",
  rowFocused: "rgb(30, 41, 59)",
  rowSelected: "rgb(30, 27, 75)",
  gridLine: "rgb(51, 65, 85)",
  gridLineMinor: "rgb(30, 41, 59)",
  eventFill: "rgb(99, 102, 241)",
  eventFillFallback: "rgb(100, 116, 139)",
  eventText: "#ffffff",
  eventOutline: "rgb(129, 140, 248)",
  dayAccent: "rgb(99, 102, 241)",
};

const resolveEventColor = (event: CalendarEvent): string => {
  return event.color === "bg-indigo-500"
    ? COLORS.eventFill
    : COLORS.eventFillFallback;
};

interface CanvasCalendarGridProps {
  days: string[];
  events: CalendarEvent[];
  focusedDay: number;
  daySelected: boolean;
  selectedEventId?: string;
  onSelectDay: (dayIndex: number) => void;
  onSelectEvent: (eventId: string, dayIndex: number) => void;
  onSlotClick: (dayIndex: number, hour: number) => void;
}

export function CanvasCalendarGrid({
  days,
  events,
  focusedDay,
  daySelected,
  selectedEventId,
  onSelectDay,
  onSelectEvent,
  onSlotClick,
}: CanvasCalendarGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);

  // Track container width with ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width && width > 0) setContainerWidth(width);
    });
    observer.observe(el);
    // Set initial width
    setContainerWidth(el.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  // Derive slot width from container so the grid always fills exactly
  const slotWidth = (containerWidth - LABEL_WIDTH) / TIME_SLOTS.length;
  const gridWidth = containerWidth - LABEL_WIDTH;
  const stageWidth = containerWidth;
  const stageHeight = HEADER_HEIGHT + days.length * ROW_HEIGHT;

  // Track current time to draw a live "now" vertical line
  const [now, setNow] = useState<Date>(new Date());
  const nowIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const nowDate = new Date();
    const msUntilNextMinute =
      (60 - nowDate.getSeconds()) * 1000 - nowDate.getMilliseconds();
    const timeoutId = window.setTimeout(() => {
      update();
      nowIntervalRef.current = window.setInterval(update, 60_000);
    }, msUntilNextMinute);

    return () => {
      clearTimeout(timeoutId);
      if (nowIntervalRef.current) {
        clearInterval(nowIntervalRef.current);
      }
    };
  }, []);

  const handleStageMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos) return;
    const { x, y } = pos;
    if (x < LABEL_WIDTH || y < HEADER_HEIGHT) return;

    const dayIndex = Math.floor((y - HEADER_HEIGHT) / ROW_HEIGHT);
    if (dayIndex < 0 || dayIndex >= days.length) return;

    const rawSlot = Math.floor((x - LABEL_WIDTH) / slotWidth);
    const slotIndex = Math.max(0, Math.min(TIME_SLOTS.length - 1, rawSlot));
    const hour = MIN_HOUR + slotIndex * SLOT_INTERVAL_HOURS;

    onSlotClick(dayIndex, hour);
  };

  return (
    <div ref={containerRef} style={{ width: "100%" }}>
      <Stage
        width={stageWidth}
        height={stageHeight}
        onMouseDown={handleStageMouseDown}
      >
        <Layer>
          {/* Background */}
          <Rect
            x={0}
            y={0}
            width={stageWidth}
            height={stageHeight}
            fill={COLORS.background}
          />

          {/* Header background */}
          <Rect
            x={0}
            y={0}
            width={stageWidth}
            height={HEADER_HEIGHT}
            fill={COLORS.headerBackground}
          />

          {/* Label/grid divider */}
          <Line
            points={[LABEL_WIDTH, 0, LABEL_WIDTH, stageHeight]}
            stroke={COLORS.gridLine}
            strokeWidth={1}
          />

          {/* Hour labels */}
          {HOUR_LABELS.map((hour: number, index: number) => {
            const x = LABEL_WIDTH + (hour - MIN_HOUR) * slotWidth * 2;
            const isAlt = index % 2 === 1;

            return (
              <React.Fragment key={hour}>
                <Rect
                  x={x}
                  y={0}
                  width={slotWidth * 2}
                  height={HEADER_HEIGHT}
                  fill={
                    isAlt
                      ? COLORS.hourLabelBackgroundAlt
                      : COLORS.hourLabelBackground
                  }
                />
                <Text
                  x={x}
                  y={6}
                  width={slotWidth * 2}
                  height={HEADER_HEIGHT}
                  text={`${String(hour).padStart(2, "0")}:00`}
                  fontSize={11}
                  fontStyle="600"
                  align="center"
                  fill={COLORS.labelText}
                />
              </React.Fragment>
            );
          })}

          {/* Vertical grid lines */}
          {TIME_SLOTS.map((slot: number, index: number) => (
            <Line
              key={`vline-${slot}`}
              points={[
                LABEL_WIDTH + index * slotWidth,
                HEADER_HEIGHT,
                LABEL_WIDTH + index * slotWidth,
                stageHeight,
              ]}
              stroke={slot % 1 === 0 ? COLORS.gridLine : COLORS.gridLineMinor}
              strokeWidth={1}
            />
          ))}

          {/* Day rows */}
          {days.map((day: string, dayIndex: number) => {
            const y = HEADER_HEIGHT + dayIndex * ROW_HEIGHT;
            const isFocused = focusedDay === dayIndex;
            const isSelected = daySelected && isFocused;

            return (
              <React.Fragment key={day}>
                {/* Row tint */}
                {(isFocused || isSelected) && (
                  <Rect
                    x={LABEL_WIDTH}
                    y={y}
                    width={gridWidth}
                    height={ROW_HEIGHT}
                    fill={isSelected ? COLORS.rowSelected : COLORS.rowFocused}
                  />
                )}

                {/* Day label background (clickable) */}
                <Rect
                  x={0}
                  y={y}
                  width={LABEL_WIDTH}
                  height={ROW_HEIGHT}
                  fill={
                    isSelected
                      ? COLORS.labelBackgroundSelected
                      : isFocused
                        ? COLORS.labelBackgroundFocused
                        : COLORS.labelBackground
                  }
                  onClick={(evt) => {
                    evt.cancelBubble = true;
                    onSelectDay(dayIndex);
                  }}
                />

                {/* Focused/selected accent bar */}
                {(isFocused || isSelected) && (
                  <Rect
                    x={0}
                    y={y}
                    width={4}
                    height={ROW_HEIGHT}
                    fill={COLORS.dayAccent}
                  />
                )}

                {/* Day label text */}
                <Text
                  x={8}
                  y={y}
                  width={LABEL_WIDTH - 12}
                  height={ROW_HEIGHT}
                  text={day.slice(0, 3)}
                  fontSize={13}
                  fontStyle="600"
                  fill={
                    isSelected
                      ? COLORS.labelTextSelected
                      : isFocused
                        ? COLORS.labelTextFocused
                        : COLORS.labelText
                  }
                  verticalAlign="middle"
                />

                {/* Row bottom border */}
                <Line
                  points={[0, y + ROW_HEIGHT, stageWidth, y + ROW_HEIGHT]}
                  stroke={COLORS.gridLine}
                  strokeWidth={1}
                />
              </React.Fragment>
            );
          })}
        </Layer>

        {/* Events layer */}
        <Layer>
          {events.map((event) => {
            const tagText = formatTags(event.tags);
            const slotIndex = Math.round(
              (event.startHour - MIN_HOUR) / SLOT_INTERVAL_HOURS,
            );
            const slotCount = Math.round(event.duration / SLOT_INTERVAL_HOURS);
            const rawLeft = LABEL_WIDTH + slotIndex * slotWidth;
            const rawWidth = slotCount * slotWidth;
            const left = Math.max(LABEL_WIDTH, rawLeft);
            const maxRight = LABEL_WIDTH + gridWidth;
            const right = Math.min(rawLeft + rawWidth, maxRight);
            const width = right - left;

            if (width <= 0) return null;

            const y = HEADER_HEIGHT + event.day * ROW_HEIGHT + EVENT_PADDING;
            const isSelected = selectedEventId === event.id;

            return (
              <React.Fragment key={event.id}>
                <Rect
                  x={left}
                  y={y}
                  width={width}
                  height={EVENT_HEIGHT}
                  fill={resolveEventColor(event)}
                  shadowBlur={isSelected ? 10 : 0}
                  shadowColor={isSelected ? COLORS.eventOutline : undefined}
                  onClick={(evt) => {
                    evt.cancelBubble = true;
                    onSelectEvent(event.id, event.day);
                  }}
                />
                {isSelected && (
                  <Rect
                    x={left}
                    y={y}
                    width={width}
                    height={EVENT_HEIGHT}
                    stroke={COLORS.eventOutline}
                    strokeWidth={2}
                  />
                )}
                <Text
                  x={left + 8}
                  y={y}
                  width={Math.max(0, width - 16)}
                  height={EVENT_HEIGHT}
                  text={tagText ? `${event.title}` : event.title}
                  fontSize={12}
                  fill={COLORS.eventText}
                  verticalAlign="middle"
                  ellipsis
                  onClick={(evt) => {
                    evt.cancelBubble = true;
                    onSelectEvent(event.id, event.day);
                  }}
                />
              </React.Fragment>
            );
          })}
        </Layer>

        {/* Now line layer (current time) */}
        <Layer>
          {(() => {
            const todayIndex = new Date().getDay();
            if (todayIndex < 0 || todayIndex >= days.length) return null;
            const hours = now.getHours() + now.getMinutes() / 60;
            if (hours < MIN_HOUR || hours > MAX_HOUR) return null;
            const slotIndexFloat = (hours - MIN_HOUR) / SLOT_INTERVAL_HOURS;
            const xNow = LABEL_WIDTH + slotIndexFloat * slotWidth;
            const yNow = HEADER_HEIGHT + todayIndex * ROW_HEIGHT;
            // Keep line within the grid bounds
            if (xNow < LABEL_WIDTH || xNow > LABEL_WIDTH + gridWidth)
              return null;
            return (
              <Line
                points={[xNow, yNow, xNow, yNow + ROW_HEIGHT]}
                stroke={"rgb(220, 38, 38)"}
                strokeWidth={2}
              />
            );
          })()}
        </Layer>
      </Stage>
    </div>
  );
}

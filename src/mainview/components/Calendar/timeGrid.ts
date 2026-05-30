export const MIN_HOUR = 4;
export const MAX_HOUR = 23;
export const SLOT_INTERVAL_HOURS = 0.5;
export const SLOT_WIDTH = 40; // px per 30-min slot

export const TIME_SLOTS: number[] = Array.from(
  { length: (MAX_HOUR - MIN_HOUR) / SLOT_INTERVAL_HOURS },
  (_, i) => MIN_HOUR + i * SLOT_INTERVAL_HOURS,
);

export const HOUR_LABELS: number[] = Array.from(
  { length: MAX_HOUR - MIN_HOUR },
  (_, i) => MIN_HOUR + i,
);

export const GRID_WIDTH = TIME_SLOTS.length * SLOT_WIDTH;

import type { Day } from './types';

export const KID_COLORS = [
  { name: 'Red',    value: '#FF6B6B' },
  { name: 'Orange', value: '#FF9E3D' },
  { name: 'Yellow', value: '#FFD93D' },
  { name: 'Green',  value: '#6BCB77' },
  { name: 'Blue',   value: '#4D96FF' },
  { name: 'Purple', value: '#C77DFF' },
  { name: 'Pink',   value: '#FF6BD6' },
  { name: 'Teal',   value: '#4ECDC4' },
];

export const KID_EMOJIS = [
  '🦁', '🐯', '🐸', '🦊', '🐼', '🐨', '🦄', '🐉',
  '🦋', '⭐', '🌈', '🚀', '🎮', '🏀', '⚽', '🎵',
  '🌺', '🦕', '🤖', '👾',
];

export const DAYS: { key: Day; label: string; short: string }[] = [
  { key: 'mon', label: 'Monday',    short: 'Mon' },
  { key: 'tue', label: 'Tuesday',   short: 'Tue' },
  { key: 'wed', label: 'Wednesday', short: 'Wed' },
  { key: 'thu', label: 'Thursday',  short: 'Thu' },
  { key: 'fri', label: 'Friday',    short: 'Fri' },
  { key: 'sat', label: 'Saturday',  short: 'Sat' },
  { key: 'sun', label: 'Sunday',    short: 'Sun' },
];

// 7 AM – 9 PM in 15-min steps → 56 slots
export const DAY_START_HOUR = 7;
export const DAY_END_HOUR   = 21;

export const ALL_TIME_SLOTS: string[] = (() => {
  const slots: string[] = [];
  for (let h = DAY_START_HOUR; h < DAY_END_HOUR; h++) {
    for (let m = 0; m < 60; m += 15) {
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return slots;
})();

export function formatTime(slot: string): string {
  const [h, m] = slot.split(':').map(Number);
  const period = h < 12 ? 'AM' : 'PM';
  const hour   = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

export function addMinutes(slot: string, minutes: number): string {
  const [h, m] = slot.split(':').map(Number);
  const total  = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function formatSlotRange(slots: string[]): string {
  if (!slots.length) return '';
  const sorted = [...slots].sort();
  const start  = sorted[0];
  const end    = addMinutes(sorted[sorted.length - 1], 15);
  return `${formatTime(start)}–${formatTime(end)}`;
}

export function slotDurationMinutes(slots: string[]): number {
  return slots.length * 15;
}

/** Returns the Day key for a JS Date (Mon–Sun). */
export function dateToDayKey(date: Date): Day {
  const js = date.getDay(); // 0=Sun
  return DAYS[js === 0 ? 6 : js - 1].key;
}

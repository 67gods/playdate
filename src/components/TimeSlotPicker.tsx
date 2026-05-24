import { useState, useRef } from 'react';
import type { Day } from '../types';
import { ALL_TIME_SLOTS, DAYS, addMinutes, formatTime } from '../constants';

interface Props {
  availability: Partial<Record<Day, string[]>>;
  color: string;
  readonly?: boolean;
  friendAvailability?: Partial<Record<Day, string[]>>;
  friendColor?: string;
  onSaveDay?: (day: Day, slots: string[]) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type SlotKind = 'unselected' | 'only' | 'start' | 'middle' | 'end';

function slotKind(slot: string, sel: Set<string>): SlotKind {
  if (!sel.has(slot)) return 'unselected';
  const i     = ALL_TIME_SLOTS.indexOf(slot);
  const prev  = i > 0 && sel.has(ALL_TIME_SLOTS[i - 1]);
  const next  = i < ALL_TIME_SLOTS.length - 1 && sel.has(ALL_TIME_SLOTS[i + 1]);
  if (!prev && !next) return 'only';
  if (!prev)          return 'start';
  if (!next)          return 'end';
  return 'middle';
}

function slotsToRanges(slots: string[]): { start: string; end: string }[] {
  if (!slots.length) return [];
  const sorted = [...slots].sort();
  const out: { start: string; end: string }[] = [];
  let start = sorted[0], prev = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const pi = ALL_TIME_SLOTS.indexOf(prev);
    const ci = ALL_TIME_SLOTS.indexOf(sorted[i]);
    if (ci === pi + 1) { prev = sorted[i]; continue; }
    out.push({ start, end: addMinutes(prev, 15) });
    start = sorted[i]; prev = sorted[i];
  }
  out.push({ start, end: addMinutes(prev, 15) });
  return out;
}

const JUMP_POINTS = [
  { label: '☀️ AM', slot: '07:00' },
  { label: '🌤️ PM', slot: '12:00' },
  { label: '🌙 Eve', slot: '17:00' },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function TimeSlotPicker({
  availability, color, readonly,
  friendAvailability, friendColor, onSaveDay,
}: Props) {
  const [activeDay, setActiveDay] = useState<Day>('mon');
  const [localSlots, setLocalSlots] = useState<string[]>(
    () => availability[activeDay] ?? []
  );

  // Keep in sync when parent availability changes
  const prevRef = useRef(availability);
  if (prevRef.current !== availability) {
    prevRef.current = availability;
    setLocalSlots(availability[activeDay] ?? []);
  }

  function switchDay(day: Day) {
    setActiveDay(day);
    setLocalSlots(availability[day] ?? []);
  }

  // Drag-select
  const dragging  = useRef(false);
  const dragMode  = useRef<'add' | 'remove'>('add');

  function startDrag(slot: string) {
    if (readonly) return;
    dragging.current = true;
    dragMode.current = localSlots.includes(slot) ? 'remove' : 'add';
    applyDrag(slot);
  }

  function applyDrag(slot: string) {
    setLocalSlots(prev => {
      if (dragMode.current === 'add'    && !prev.includes(slot)) return [...prev, slot].sort();
      if (dragMode.current === 'remove' &&  prev.includes(slot)) return prev.filter(s => s !== slot);
      return prev;
    });
  }

  function endDrag() {
    if (!dragging.current) return;
    dragging.current = false;
    setLocalSlots(cur => { onSaveDay?.(activeDay, cur); return cur; });
  }

  function removeRange(rangeStart: string) {
    const si  = ALL_TIME_SLOTS.indexOf(rangeStart);
    const sel = new Set(localSlots);
    let i     = si;
    while (i < ALL_TIME_SLOTS.length && sel.has(ALL_TIME_SLOTS[i])) i++;
    const toRemove = ALL_TIME_SLOTS.slice(si, i);
    const next = localSlots.filter(s => !toRemove.includes(s));
    setLocalSlots(next);
    onSaveDay?.(activeDay, next);
  }

  function clearDay() {
    setLocalSlots([]);
    onSaveDay?.(activeDay, []);
  }

  const scrollRef = useRef<HTMLDivElement>(null);

  function jumpTo(slot: string) {
    const target    = document.getElementById(`ts-${slot}`);
    const container = scrollRef.current;
    if (!target || !container) return;
    container.scrollTo({
      top: target.offsetTop - container.offsetTop,
      behavior: 'smooth',
    });
  }

  function scrollBy(direction: 'up' | 'down') {
    const c = scrollRef.current;
    if (!c) return;
    const step = c.clientHeight * 0.7;
    c.scrollBy({ top: direction === 'up' ? -step : step, behavior: 'smooth' });
  }

  const sel         = new Set(localSlots);
  const friendSel   = new Set(friendAvailability?.[activeDay] ?? []);
  const myRanges    = slotsToRanges(localSlots);
  const friendRanges = friendAvailability ? slotsToRanges([...friendSel].sort()) : [];

  // Group ALL_TIME_SLOTS by hour for rendering dividers
  const hours = Array.from({ length: 14 }, (_, i) => 7 + i);

  return (
    <div
      className="select-none"
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
    >
      {/* ── Day tabs ────────────────────────────────────────────── */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {DAYS.map(d => {
          const rangeCount = slotsToRanges((availability[d.key] ?? []).sort()).length;
          const active     = activeDay === d.key;
          return (
            <button
              key={d.key}
              onClick={() => switchDay(d.key)}
              className={`flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-2xl font-black text-xs transition-all active:scale-95 ${
                active ? 'text-white shadow-md' : 'bg-gray-100 text-gray-500'
              }`}
              style={active ? { backgroundColor: color } : {}}
            >
              {d.short}
              {rangeCount > 0 && (
                <span
                  className="mt-0.5 text-[9px] font-black rounded px-1 leading-tight"
                  style={active
                    ? { backgroundColor: 'rgba(255,255,255,0.3)', color: 'white' }
                    : { backgroundColor: color + '22', color }}
                >
                  {rangeCount}×
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── My range chips ──────────────────────────────────────── */}
      {myRanges.length > 0 && (
        <div className="mb-3">
          <p className="text-[11px] font-black text-gray-400 uppercase tracking-wide mb-1.5">
            {readonly ? 'Available' : 'You\'re free'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {myRanges.map(r => (
              <div
                key={r.start}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-white text-xs font-black"
                style={{ backgroundColor: color }}
              >
                {formatTime(r.start)} – {formatTime(r.end)}
                {!readonly && (
                  <button
                    onClick={() => removeRange(r.start)}
                    className="text-white/60 hover:text-white font-black text-sm leading-none"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Friend range chips ──────────────────────────────────── */}
      {friendAvailability && friendRanges.length > 0 && (
        <div className="mb-3">
          <p className="text-[11px] font-black text-gray-400 uppercase tracking-wide mb-1.5">
            Their free times
          </p>
          <div className="flex flex-wrap gap-1.5">
            {friendRanges.map(r => (
              <div
                key={r.start}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-white text-xs font-black"
                style={{ backgroundColor: friendColor ?? '#888' }}
              >
                {formatTime(r.start)} – {formatTime(r.end)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Jump buttons + clear ────────────────────────────────── */}
      <div className="flex gap-1.5 mb-3">
        {JUMP_POINTS.map(jp => (
          <button
            key={jp.slot}
            onClick={() => jumpTo(jp.slot)}
            className="flex-1 py-1.5 rounded-xl text-xs font-black bg-gray-100 text-gray-500 active:scale-95 transition-transform"
          >
            {jp.label}
          </button>
        ))}
        {!readonly && (
          <button
            onClick={clearDay}
            className="px-3 py-1.5 rounded-xl text-xs font-black text-red-400 bg-red-50 active:scale-95"
          >
            Clear
          </button>
        )}
      </div>

      {/* ── Slot list ───────────────────────────────────────────── */}
      <div
        className="relative rounded-3xl bg-white shadow-sm"
        style={{ border: `3px solid ${color}` }}
      >
        {/* Up arrow */}
        <button
          type="button"
          onClick={() => scrollBy('up')}
          aria-label="Scroll up"
          className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 w-12 h-12 rounded-full text-white text-2xl font-black shadow-lg active:scale-90 transition-transform"
          style={{ backgroundColor: color }}
        >
          ↑
        </button>

        {/* Down arrow */}
        <button
          type="button"
          onClick={() => scrollBy('down')}
          aria-label="Scroll down"
          className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-20 w-12 h-12 rounded-full text-white text-2xl font-black shadow-lg active:scale-90 transition-transform"
          style={{ backgroundColor: color }}
        >
          ↓
        </button>

        {/* Top fade hint */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-6 z-10 rounded-t-3xl"
             style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.95), transparent)' }} />
        {/* Bottom fade hint */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 z-10 rounded-b-3xl"
             style={{ background: 'linear-gradient(to top, rgba(255,255,255,0.95), transparent)' }} />

        <div
          ref={scrollRef}
          className="overflow-y-auto always-scroll max-h-[52vh] md:max-h-[65vh] rounded-3xl"
        >
        {hours.map(h => (
          <div key={h}>
            {/* Hour header */}
            <div
              id={`ts-${String(h).padStart(2,'0')}:00`}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border-b border-gray-100 sticky top-0 z-10"
            >
              <span className="text-xs font-black text-gray-400 w-14">
                {h === 0 ? 12 : h > 12 ? h - 12 : h}{h < 12 ? ' AM' : ' PM'}
              </span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Four 15-min slots for this hour */}
            {[0, 15, 30, 45].map(m => {
              const slot   = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
              const kind   = slotKind(slot, sel);
              const fri    = friendSel.has(slot);
              const both   = kind !== 'unselected' && fri;
              const barBg  = both && friendAvailability ? '#22C55E' : color;

              const radius =
                kind === 'only'   ? '10px' :
                kind === 'start'  ? '10px 10px 0 0' :
                kind === 'end'    ? '0 0 10px 10px' :
                '0';

              const endTime = addMinutes(slot, 15);

              return (
                <div
                  key={slot}
                  className="flex items-center"
                  style={{ height: 44 }}
                >
                  {/* Time label */}
                  <span
                    className="text-xs font-bold flex-shrink-0 pl-3 w-20"
                    style={{ color: kind !== 'unselected' ? '#374151' : '#D1D5DB' }}
                  >
                    {formatTime(slot)}
                  </span>

                  {/* Tap / drag area */}
                  <div
                    className="flex-1 pr-3 h-full flex items-center"
                    style={{ cursor: readonly ? 'default' : 'pointer', touchAction: 'none' }}
                    onPointerDown={() => startDrag(slot)}
                    onPointerEnter={() => dragging.current && applyDrag(slot)}
                  >
                    {kind === 'unselected' ? (
                      /* Unselected row */
                      <div
                        className="w-full h-8 rounded-xl transition-colors"
                        style={{
                          backgroundColor: fri && friendAvailability
                            ? (friendColor ?? '#888') + '22'
                            : readonly ? 'transparent' : '#F9FAFB',
                        }}
                      >
                        {fri && friendAvailability && (
                          <div className="h-full flex items-center pl-2">
                            <span className="text-[10px] font-bold" style={{ color: friendColor }}>
                              free
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Selected bar */
                      <div
                        className="w-full flex items-center justify-between px-3 transition-all"
                        style={{
                          height: kind === 'middle' ? 44 : 38,
                          backgroundColor: barBg,
                          borderRadius: radius,
                          opacity: 0.92,
                        }}
                      >
                        {/* Start label */}
                        {(kind === 'start' || kind === 'only') && (
                          <span className="text-white font-black text-xs">
                            {formatTime(slot)}
                          </span>
                        )}
                        {(kind === 'middle') && <span />}

                        {/* End label */}
                        {(kind === 'end' || kind === 'only') && (
                          <span className="text-white font-black text-xs">
                            → {formatTime(endTime)}
                          </span>
                        )}

                        {/* Overlap star */}
                        {both && <span className="text-white text-xs absolute right-4">✨</span>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        </div>
      </div>

      <p className="text-center text-xs text-gray-400 font-bold mt-6">
        ↑ Use arrows or swipe to see more times ↓
      </p>

      {myRanges.length === 0 && !readonly && (
        <p className="text-center text-sm text-gray-400 font-semibold mt-3">
          Tap a time or drag across slots to mark when you're free
        </p>
      )}
    </div>
  );
}

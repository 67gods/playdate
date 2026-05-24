import { useState, useMemo } from 'react';
import type { Friend, UserProfile } from '../types';
import {
  ALL_TIME_SLOTS,
  DAY_START_HOUR,
  DAY_END_HOUR,
  formatTime,
  formatSlotRange,
  slotDurationMinutes,
  dateToDayKey,
} from '../constants';

interface Props {
  friend: Friend;
  currentUser: UserProfile;
  prefill?: { date: string; timeSlots: string[] };
  onSubmit: (data: { type: 'playdate' | 'meeting'; date: string; timeSlots: string[]; message: string }) => void;
  onClose: () => void;
}

const HOURS = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i);

export default function RequestPlaydateModal({ friend, currentUser, prefill, onSubmit, onClose }: Props) {
  const [type, setType] = useState<'playdate' | 'meeting'>('playdate');
  const [date, setDate] = useState(prefill?.date ?? '');
  const [timeSlots, setTimeSlots] = useState<string[]>(prefill?.timeSlots ?? []);
  const [message, setMessage] = useState('');

  const slotsSet = useMemo(() => new Set(timeSlots), [timeSlots]);

  function toggleSlot(slot: string) {
    setTimeSlots((prev) => {
      const set = new Set(prev);
      if (set.has(slot)) set.delete(slot);
      else set.add(slot);
      return [...set].sort();
    });
  }

  const today = new Date().toISOString().split('T')[0];

  const dayKey = date ? dateToDayKey(new Date(date + 'T12:00:00')) : null;
  const mySlots     = useMemo(() => new Set(dayKey ? currentUser.availability[dayKey] ?? [] : []), [dayKey, currentUser.availability]);
  const friendSlots = useMemo(() => new Set(dayKey ? friend.availability[dayKey] ?? []     : []), [dayKey, friend.availability]);

  // Stats for selected day
  const overlap = dayKey
    ? ALL_TIME_SLOTS.filter((s) => mySlots.has(s) && friendSlots.has(s)).length
    : 0;

  function slotStyle(slot: string): { bg: string; opacity: number; label: string } {
    const me  = mySlots.has(slot);
    const fri = friendSlots.has(slot);
    if (me && fri) return { bg: '#22C55E', opacity: 1,   label: '✅ Both free' };
    if (me)        return { bg: currentUser.color, opacity: 0.7, label: 'Only you free' };
    if (fri)       return { bg: friend.color,      opacity: 0.5, label: `Only ${friend.displayName} free` };
    return           { bg: '#E5E7EB', opacity: 0.4, label: 'Both busy' };
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-[#FFF8F0] rounded-t-3xl w-full max-w-md max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1.5 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
            style={{ backgroundColor: friend.color + '33' }}
          >
            {friend.emoji}
          </div>
          <div>
            <p className="font-black text-xl text-gray-800">{friend.displayName}</p>
            <p className="text-gray-400 font-semibold text-sm">@{friend.username}</p>
          </div>
        </div>

        <div className="px-5 pb-8 flex flex-col gap-4">
          {/* Type */}
          <div className="flex gap-2">
            {(['playdate', 'meeting'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 py-3 rounded-2xl font-black text-sm transition-all active:scale-95 ${
                  type === t ? 'text-white shadow-md' : 'bg-gray-100 text-gray-500'
                }`}
                style={type === t ? { backgroundColor: friend.color } : {}}
              >
                {t === 'playdate' ? '🎉 PlayDate' : '📅 Meeting'}
              </button>
            ))}
          </div>

          {/* Date */}
          <label className="block">
            <span className="font-black text-gray-700 block mb-2">📆 Pick a day</span>
            <input
              type="date"
              min={today}
              value={date}
              onChange={(e) => { setDate(e.target.value); setTimeSlots([]); }}
              className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-700 bg-white focus:outline-none focus:border-blue-400"
            />
          </label>

          {/* Time slot picker — shown once date is chosen */}
          {date && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-black text-gray-700">⏰ Pick a time</span>
                {overlap > 0 && (
                  <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-xl">
                    ✅ {overlap} slots where you're both free!
                  </span>
                )}
              </div>

              {/* Legend */}
              <div className="flex gap-3 mb-3 flex-wrap">
                {[
                  { bg: '#22C55E', label: 'Both free' },
                  { bg: currentUser.color, label: 'You free' },
                  { bg: friend.color, label: `${friend.displayName} free` },
                  { bg: '#E5E7EB', label: 'Both busy' },
                ].map((l) => (
                  <span key={l.label} className="flex items-center gap-1 text-[11px] font-bold text-gray-500">
                    <span className="w-3 h-3 rounded inline-block" style={{ backgroundColor: l.bg }} />
                    {l.label}
                  </span>
                ))}
              </div>

              {/* Hour groups */}
              <div className="max-h-52 overflow-y-auto bg-white rounded-2xl p-3 border-2 border-gray-100">
                {HOURS.map((h) => {
                  const hourSlots = ALL_TIME_SLOTS.filter((s) => parseInt(s) === h);
                  const period    = h < 12 ? 'AM' : 'PM';
                  const label     = h === 0 ? 12 : h > 12 ? h - 12 : h;

                  return (
                    <div key={h} className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-black text-gray-400 w-14 flex-shrink-0 text-right">
                        {label} {period}
                      </span>
                      <div className="flex gap-1 flex-1">
                        {hourSlots.map((slot) => {
                          const { bg, opacity } = slotStyle(slot);
                          const selected = slotsSet.has(slot);
                          const [, mm] = slot.split(':');
                          return (
                            <button
                              key={slot}
                              onClick={() => toggleSlot(slot)}
                              className={`flex-1 h-10 rounded-lg flex items-end justify-center pb-0.5 transition-all active:scale-95 ${
                                selected ? 'ring-2 ring-offset-1 ring-gray-800 scale-105' : ''
                              }`}
                              style={{ backgroundColor: bg, opacity: selected ? 1 : opacity }}
                              title={`${formatTime(slot)} — ${slotStyle(slot).label}`}
                            >
                              <span className="text-[9px] font-black text-white/80">:{mm}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {timeSlots.length > 0 && (
                <div className="text-center mt-2">
                  <p className="font-black" style={{ color: friend.color }}>
                    Selected: {formatSlotRange(timeSlots)}
                  </p>
                  <p className="text-xs text-gray-500 font-semibold mt-0.5">
                    {slotDurationMinutes(timeSlots)} min · {timeSlots.length} slot{timeSlots.length > 1 ? 's' : ''}
                    {timeSlots.length > 1 && (
                      <button
                        onClick={() => setTimeSlots([])}
                        className="ml-2 underline text-gray-400 hover:text-gray-600"
                      >
                        clear
                      </button>
                    )}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Message */}
          <label className="block">
            <span className="font-black text-gray-700 block mb-2">💬 Message (optional)</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Let's hang out!"
              rows={2}
              className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 font-semibold text-gray-700 bg-white focus:outline-none focus:border-blue-400 resize-none"
            />
          </label>

          <button
            disabled={!date || timeSlots.length === 0}
            onClick={() => onSubmit({ type, date, timeSlots, message })}
            className="w-full py-4 rounded-3xl font-black text-white text-lg shadow-lg active:scale-95 transition-transform disabled:opacity-40"
            style={{ backgroundColor: friend.color }}
          >
            Send Request! 🎉
          </button>
        </div>
      </div>
    </div>
  );
}

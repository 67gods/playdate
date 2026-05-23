import type { Day } from '../types';
import { DAYS, ALL_TIME_SLOTS } from '../constants';

interface Props {
  availability: Partial<Record<Day, string[]>>;
  color: string;
}

/**
 * Compact read-only heatmap: one row per day, one pixel-wide block per 15-min slot.
 * Used in collapsed friend cards and profile previews.
 */
export default function AvailabilityGrid({ availability, color }: Props) {
  return (
    <div className="flex flex-col gap-1">
      {DAYS.map((d) => {
        const slots = new Set(availability[d.key] ?? []);
        const count = slots.size;
        return (
          <div key={d.key} className="flex items-center gap-2">
            <span className="text-xs font-black text-gray-400 w-8 flex-shrink-0">{d.short}</span>
            <div className="flex gap-px flex-1 h-5 items-center">
              {ALL_TIME_SLOTS.map((slot) => (
                <div
                  key={slot}
                  className="flex-1 h-4 rounded-sm"
                  style={{
                    backgroundColor: slots.has(slot) ? color : '#E5E7EB',
                    opacity: slots.has(slot) ? 1 : 0.3,
                  }}
                />
              ))}
            </div>
            <span className="text-[10px] font-bold text-gray-400 w-8 text-right flex-shrink-0">
              {count > 0 ? `${count}×` : '—'}
            </span>
          </div>
        );
      })}
      <div className="flex items-center gap-1 mt-1">
        <span className="text-[10px] text-gray-400 font-semibold">7 AM</span>
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-[10px] text-gray-400 font-semibold">9 PM</span>
      </div>
    </div>
  );
}

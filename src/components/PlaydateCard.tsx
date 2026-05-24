import type { Playdate, UserProfile } from '../types';
import { formatTime, formatSlotRange, slotDurationMinutes } from '../constants';

interface Props {
  playdate: Playdate;
  currentUser: UserProfile;
  onConfirm?: (id: string) => void;
  onDecline?: (id: string) => void;
}

const STATUS_LABEL: Record<string, string> = {
  pending: '⏳ Pending',
  confirmed: '✅ Confirmed',
  declined: '❌ Declined',
};

export default function PlaydateCard({ playdate, currentUser, onConfirm, onDecline }: Props) {
  const isIncoming = playdate.recipientId === currentUser.uid;
  const otherColor = isIncoming ? playdate.requesterColor : playdate.recipientColor;
  const otherEmoji = isIncoming ? playdate.requesterEmoji : playdate.recipientEmoji;
  const otherName = isIncoming ? playdate.requesterName : playdate.recipientName;
  const timeLabel = playdate.timeSlots.length === 1
    ? formatTime(playdate.timeSlots[0])
    : `${formatSlotRange(playdate.timeSlots)} (${slotDurationMinutes(playdate.timeSlots)}m)`;

  const dateLabel = new Date(playdate.date + 'T12:00:00').toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div
      className="rounded-3xl p-4 shadow-sm bg-white mb-3"
      style={{ borderLeft: `6px solid ${otherColor}` }}
    >
      <div className="flex items-center gap-3 mb-2">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
          style={{ backgroundColor: otherColor + '33' }}
        >
          {otherEmoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-gray-800 text-lg leading-tight">{otherName}</p>
          <p className="text-sm text-gray-500 font-semibold">
            {playdate.type === 'playdate' ? '🎉 PlayDate' : '📅 Meeting'}
          </p>
        </div>
        <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-xl">
          {STATUS_LABEL[playdate.status]}
        </span>
      </div>

      <div className="flex gap-4 text-sm font-semibold text-gray-600 mb-1">
        <span>📆 {dateLabel}</span>
        <span>⏰ {timeLabel}</span>
      </div>

      {playdate.message && (
        <p className="text-sm text-gray-500 italic mt-1">"{playdate.message}"</p>
      )}

      {playdate.parentApprovalNeeded && !playdate.parentApproved && playdate.status === 'confirmed' && (
        <div className="mt-2 text-xs font-bold text-orange-500 bg-orange-50 rounded-xl px-3 py-1">
          👨‍👩‍👧 Waiting for parent approval
        </div>
      )}

      {isIncoming && playdate.status === 'pending' && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => onConfirm?.(playdate.id)}
            className="flex-1 py-2 rounded-2xl font-black text-white text-sm active:scale-95 transition-transform"
            style={{ backgroundColor: otherColor }}
          >
            ✅ Accept!
          </button>
          <button
            onClick={() => onDecline?.(playdate.id)}
            className="flex-1 py-2 rounded-2xl font-black text-gray-600 text-sm bg-gray-100 active:scale-95 transition-transform"
          >
            ❌ No thanks
          </button>
        </div>
      )}
    </div>
  );
}

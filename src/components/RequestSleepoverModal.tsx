import { useState } from 'react';
import type { Friend, UserProfile } from '../types';

interface Props {
  friend: Friend;
  currentUser: UserProfile;
  onSubmit: (data: { host: 'me' | 'them'; date: string; dropOffTime: string; pickUpTime: string; message: string }) => void;
  onClose: () => void;
}

export default function RequestSleepoverModal({ friend, currentUser, onSubmit, onClose }: Props) {
  const today = new Date().toISOString().split('T')[0];

  const [host, setHost]               = useState<'me' | 'them'>('me');
  const [date, setDate]               = useState(today);       // default: tonight
  const [dropOffTime, setDropOffTime] = useState('19:00');     // default: 7:00 PM
  const [pickUpTime, setPickUpTime]   = useState('10:00');     // default: 10:00 AM
  const [message, setMessage]         = useState('');
  const canSubmit = !!date && !!dropOffTime && !!pickUpTime;

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
            <p className="font-black text-xl text-gray-800">🛌 Sleepover with {friend.displayName}</p>
            <p className="text-gray-400 font-semibold text-sm">@{friend.username}</p>
          </div>
        </div>

        <div className="px-5 pb-8 flex flex-col gap-4">
          {/* Host house */}
          <div>
            <span className="font-black text-gray-700 block mb-2">🏠 Whose house?</span>
            <div className="flex gap-2">
              {([
                { key: 'me' as const,   label: 'My house' },
                { key: 'them' as const, label: `${friend.displayName}'s house` },
              ]).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setHost(opt.key)}
                  className={`flex-1 py-3 rounded-2xl font-black text-sm transition-all active:scale-95 ${
                    host === opt.key ? 'text-white shadow-md' : 'bg-gray-100 text-gray-500'
                  }`}
                  style={host === opt.key ? { backgroundColor: friend.color } : {}}
                >
                  🏠 {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <label className="block">
            <span className="font-black text-gray-700 block mb-2">📆 Which night?</span>
            <input
              type="date"
              min={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-700 bg-white focus:outline-none focus:border-blue-400"
            />
          </label>

          {/* Times */}
          <div className="flex gap-2">
            <label className="flex-1 block">
              <span className="font-black text-gray-700 block mb-2">🌙 Drop-off</span>
              <input
                type="time"
                value={dropOffTime}
                onChange={(e) => setDropOffTime(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-700 bg-white focus:outline-none focus:border-blue-400"
              />
            </label>
            <label className="flex-1 block">
              <span className="font-black text-gray-700 block mb-2">☀️ Pick-up</span>
              <input
                type="time"
                value={pickUpTime}
                onChange={(e) => setPickUpTime(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-700 bg-white focus:outline-none focus:border-blue-400"
              />
            </label>
          </div>
          <p className="text-xs text-gray-400 font-semibold -mt-2">Pick-up is the next morning.</p>

          {/* Message */}
          <label className="block">
            <span className="font-black text-gray-700 block mb-2">💬 Message (optional)</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Can't wait for the sleepover!"
              rows={2}
              className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 font-semibold text-gray-700 bg-white focus:outline-none focus:border-blue-400 resize-none"
            />
          </label>

          <button
            disabled={!canSubmit}
            onClick={() => onSubmit({ host, date, dropOffTime, pickUpTime, message })}
            className="w-full py-4 rounded-3xl font-black text-white text-lg shadow-lg active:scale-95 transition-transform disabled:opacity-40"
            style={{ backgroundColor: currentUser.color }}
          >
            Send Sleepover Request! 🛌
          </button>
        </div>
      </div>
    </div>
  );
}

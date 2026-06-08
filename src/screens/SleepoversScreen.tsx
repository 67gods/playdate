import { useState } from 'react';
import type { Friend, Sleepover, UserProfile } from '../types';
import { formatTime } from '../constants';

interface Props {
  currentUser: UserProfile;
  sleepovers: Sleepover[];
  friends: Friend[];
  onConfirm: (id: string) => Promise<void>;
  onDecline: (id: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
  onRequestSleepover: (friend: Friend) => void;
}

const STATUS_PILL: Record<Sleepover['status'], { label: string; cls: string }> = {
  pending:   { label: 'Pending',   cls: 'bg-amber-100 text-amber-700' },
  confirmed: { label: 'Confirmed', cls: 'bg-green-100 text-green-700' },
  declined:  { label: 'Declined',  cls: 'bg-gray-100 text-gray-500' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-100 text-red-600' },
};

export default function SleepoversScreen({
  currentUser,
  sleepovers,
  friends,
  onConfirm,
  onDecline,
  onCancel,
  onRequestSleepover,
}: Props) {
  const [tab, setTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [picking, setPicking] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const incoming = sleepovers.filter((s) => s.recipientId === currentUser.uid);
  const outgoing = sleepovers.filter((s) => s.requesterId === currentUser.uid);
  const shown = tab === 'incoming' ? incoming : outgoing;
  const pendingIncoming = incoming.filter((s) => s.status === 'pending').length;

  async function run(id: string, fn: (id: string) => Promise<void>) {
    setBusy(id);
    try {
      await fn(id);
      setConfirmingCancel(null);
    } finally {
      setBusy(null);
    }
  }

  function formatDate(d: string) {
    return new Date(d + 'T12:00:00').toLocaleDateString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric',
    });
  }

  return (
    <div>
      <h1 className="font-black text-2xl text-gray-800 mb-1">🛌 Sleepovers</h1>
      <p className="text-gray-500 font-semibold mb-4">Plan an overnight with a friend</p>

      {/* Plan button */}
      <button
        onClick={() => setPicking(true)}
        className="w-full py-3 mb-5 rounded-2xl font-black text-white shadow-sm active:scale-95 transition-transform"
        style={{ backgroundColor: currentUser.color }}
      >
        + Plan a sleepover
      </button>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {(['incoming', 'outgoing'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 rounded-2xl font-black text-sm transition-all active:scale-95 relative ${
              tab === t ? 'text-white shadow-md' : 'bg-white text-gray-500 shadow-sm'
            }`}
            style={tab === t ? { backgroundColor: currentUser.color } : {}}
          >
            {t === 'incoming' ? '📥 Incoming' : '📤 Outgoing'}
            {t === 'incoming' && pendingIncoming > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">
                {pendingIncoming}
              </span>
            )}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-3xl shadow-sm">
          <p className="text-5xl mb-3">🛌</p>
          <p className="font-black text-gray-600 text-lg">No sleepovers yet!</p>
          <p className="text-gray-400 font-semibold text-sm mt-1">
            Tap "Plan a sleepover" to invite a friend
          </p>
        </div>
      ) : (
        shown.map((so) => {
          const isRecipient = so.recipientId === currentUser.uid;
          const other = isRecipient
            ? { name: so.requesterName, color: so.requesterColor, emoji: so.requesterEmoji }
            : { name: so.recipientName, color: so.recipientColor, emoji: so.recipientEmoji };
          const atMyHouse = so.hostId === currentUser.uid;
          const hostLabel = atMyHouse ? 'At your house' : `At ${other.name}'s house`;
          const pill = STATUS_PILL[so.status];
          const canCancel = so.status === 'pending' || so.status === 'confirmed';
          const cancelledByMe = so.cancelledBy === currentUser.uid;

          return (
            <div key={so.id} className="bg-white rounded-3xl p-4 shadow-sm mb-3">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ backgroundColor: other.color + '33' }}
                >
                  {other.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-gray-800">{other.name}</p>
                  <p className="text-xs text-gray-400 font-semibold">🏠 {hostLabel}</p>
                </div>
                <span className={`text-[11px] font-black px-2 py-1 rounded-xl ${pill.cls}`}>
                  {pill.label}
                </span>
              </div>

              <div className="bg-gray-50 rounded-2xl px-3 py-2 mb-3">
                <p className="font-black text-gray-700 text-sm">📆 {formatDate(so.date)}</p>
                <p className="text-sm text-gray-500 font-semibold">
                  🌙 Drop-off {formatTime(so.dropOffTime)} · ☀️ Pick-up {formatTime(so.pickUpTime)} (next morning)
                </p>
              </div>

              {so.message && (
                <p className="text-sm text-gray-600 font-semibold mb-3">💬 {so.message}</p>
              )}

              {so.status === 'cancelled' && (
                <p className="text-xs text-red-500 font-bold mb-1">
                  Cancelled by {cancelledByMe ? 'you' : other.name}
                </p>
              )}

              {/* Actions */}
              {isRecipient && so.status === 'pending' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => run(so.id, onDecline)}
                    disabled={busy === so.id}
                    className="flex-1 py-2 rounded-2xl font-black text-gray-500 bg-gray-100 text-sm active:scale-95 transition-transform disabled:opacity-60"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => run(so.id, onConfirm)}
                    disabled={busy === so.id}
                    className="flex-1 py-2 rounded-2xl font-black text-white text-sm active:scale-95 transition-transform disabled:opacity-60"
                    style={{ backgroundColor: other.color }}
                  >
                    Accept!
                  </button>
                </div>
              )}

              {canCancel && !(isRecipient && so.status === 'pending') && (
                confirmingCancel === so.id ? (
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <span className="font-bold text-gray-500">Cancel sleepover?</span>
                    <button
                      onClick={() => run(so.id, onCancel)}
                      disabled={busy === so.id}
                      className="px-3 py-1.5 rounded-2xl font-black text-white bg-red-400 active:scale-95 transition-transform disabled:opacity-60"
                    >
                      {busy === so.id ? '⏳' : 'Yes'}
                    </button>
                    <button
                      onClick={() => setConfirmingCancel(null)}
                      className="px-3 py-1.5 rounded-2xl font-black text-gray-500 bg-gray-100 active:scale-95 transition-transform"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmingCancel(so.id)}
                    className="w-full py-2 rounded-2xl font-bold text-red-400 text-sm active:scale-95 transition-transform"
                  >
                    Cancel sleepover
                  </button>
                )
              )}
            </div>
          );
        })
      )}

      {/* Friend picker overlay */}
      {picking && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setPicking(false)}>
          <div
            className="bg-[#FFF8F0] rounded-t-3xl w-full max-w-md max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1.5 rounded-full bg-gray-300" />
            </div>
            <h2 className="font-black text-xl text-gray-800 px-5 py-3">Pick a friend</h2>
            <div className="px-5 pb-8 flex flex-col gap-2">
              {friends.length === 0 ? (
                <p className="text-gray-400 font-semibold text-center py-6">
                  Add some friends first!
                </p>
              ) : (
                friends.map((f) => (
                  <button
                    key={f.uid}
                    onClick={() => { setPicking(false); onRequestSleepover(f); }}
                    className="flex items-center gap-3 bg-white rounded-2xl p-3 shadow-sm active:scale-95 transition-transform text-left"
                  >
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
                      style={{ backgroundColor: f.color + '33' }}
                    >
                      {f.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-gray-800">{f.displayName}</p>
                      <p className="text-xs text-gray-400 font-semibold">@{f.username}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

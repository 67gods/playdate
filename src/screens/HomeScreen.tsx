import type { Friend, Playdate, SuggestionBlock, UserProfile } from '../types';
import { ALL_TIME_SLOTS, formatTime, formatSlotRange } from '../constants';
import { computeSuggestions, friendlyDate } from '../lib/suggestions';

interface Props {
  currentUser: UserProfile;
  friends: Friend[];
  playdates: Playdate[];
  navigate: (s: 'availability' | 'friends' | 'requests') => void;
  onRequestPlaydate: (friend: Friend, prefill?: { date: string; timeSlots: string[] }) => void;
}

export default function HomeScreen({ currentUser, friends, playdates, navigate, onRequestPlaydate }: Props) {
  const suggestions = computeSuggestions(currentUser, friends);

  const upcoming = playdates
    .filter((p) => p.status === 'confirmed' && p.date >= new Date().toISOString().split('T')[0])
    .sort((a, b) => (a.date + (a.timeSlots[0] ?? '')).localeCompare(b.date + (b.timeSlots[0] ?? '')))
    .slice(0, 3);

  const pendingCount = playdates.filter(
    (p) => p.recipientId === currentUser.uid && p.status === 'pending'
  ).length;

  return (
    <div>
      {/* Greeting */}
      <div
        className="rounded-3xl p-5 mb-5 flex items-center gap-4"
        style={{ backgroundColor: currentUser.color + '22' }}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-4xl flex-shrink-0"
          style={{ backgroundColor: currentUser.color + '44' }}
        >
          {currentUser.emoji}
        </div>
        <div>
          <p className="font-black text-2xl text-gray-800">Hi {currentUser.displayName}! 👋</p>
          <p className="text-gray-500 font-semibold">Ready to make plans?</p>
        </div>
      </div>

      {/* Pending alert */}
      {pendingCount > 0 && (
        <button
          onClick={() => navigate('requests')}
          className="w-full rounded-3xl p-4 mb-5 bg-yellow-50 border-2 border-yellow-300 text-left active:scale-95 transition-transform"
        >
          <p className="font-black text-yellow-700 text-lg">
            📬 {pendingCount} playdate request{pendingCount > 1 ? 's' : ''}!
          </p>
          <p className="text-yellow-600 font-semibold text-sm">Tap to see them →</p>
        </button>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <button
          onClick={() => navigate('availability')}
          className="rounded-3xl p-4 bg-white shadow-sm text-left active:scale-95 transition-transform"
        >
          <div className="text-3xl mb-1">📅</div>
          <p className="font-black text-gray-800">My Time</p>
          <p className="text-xs text-gray-500 font-semibold">Set when you're free</p>
        </button>
        <button
          onClick={() => navigate('friends')}
          className="rounded-3xl p-4 bg-white shadow-sm text-left active:scale-95 transition-transform"
        >
          <div className="text-3xl mb-1">👥</div>
          <p className="font-black text-gray-800">Friends</p>
          <p className="text-xs text-gray-500 font-semibold">Find & add friends</p>
        </button>
      </div>

      {/* ✨ Smart suggestions */}
      {suggestions.length > 0 && (
        <div className="mb-5">
          <h2 className="font-black text-gray-700 text-lg mb-3">✨ Great times to play!</h2>
          <div className="flex flex-col gap-2">
            {suggestions.slice(0, 5).map((block, i) => (
              <SuggestionCard
                key={i}
                block={block}
                currentUser={currentUser}
                onRequest={(friend) => {
                  const slots = ALL_TIME_SLOTS.filter((s) => s >= block.startSlot && s < block.endSlot);
                  onRequestPlaydate(friend, { date: block.date, timeSlots: slots });
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming confirmed */}
      {upcoming.length > 0 && (
        <div className="mb-5">
          <h2 className="font-black text-gray-700 text-lg mb-3">🎉 Coming up!</h2>
          {upcoming.map((pd) => {
            const isMe     = pd.requesterId === currentUser.uid;
            const otherName  = isMe ? pd.recipientName  : pd.requesterName;
            const otherColor = isMe ? pd.recipientColor : pd.requesterColor;
            const otherEmoji = isMe ? pd.recipientEmoji : pd.requesterEmoji;
            const dateLabel  = new Date(pd.date + 'T12:00:00').toLocaleDateString(undefined, {
              weekday: 'short', month: 'short', day: 'numeric',
            });
            return (
              <div
                key={pd.id}
                className="flex items-center gap-3 bg-white rounded-3xl p-3 shadow-sm mb-2"
                style={{ borderLeft: `5px solid ${otherColor}` }}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ backgroundColor: otherColor + '33' }}
                >
                  {otherEmoji}
                </div>
                <div>
                  <p className="font-black text-gray-800">{otherName}</p>
                  <p className="text-xs text-gray-500 font-semibold">
                    📆 {dateLabel} · {pd.timeSlots.length === 1 ? formatTime(pd.timeSlots[0]) : formatSlotRange(pd.timeSlots)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {friends.length === 0 && (
        <div className="text-center py-8">
          <p className="text-5xl mb-3">👥</p>
          <p className="font-black text-gray-600 text-lg">No friends yet!</p>
          <p className="text-gray-400 font-semibold mb-4">Add friends to start planning playdates</p>
          <button
            onClick={() => navigate('friends')}
            className="px-6 py-3 rounded-3xl font-black text-white shadow-lg active:scale-95 transition-transform"
            style={{ backgroundColor: currentUser.color }}
          >
            Find Friends →
          </button>
        </div>
      )}

      {friends.length > 0 && suggestions.length === 0 && (
        <div className="text-center py-6 bg-white rounded-3xl shadow-sm">
          <p className="text-3xl mb-2">📅</p>
          <p className="font-black text-gray-600">No overlap yet!</p>
          <p className="text-gray-400 font-semibold text-sm mt-1 mb-3">
            Set your free times so the app can find matches
          </p>
          <button
            onClick={() => navigate('availability')}
            className="px-5 py-2 rounded-2xl font-black text-white text-sm active:scale-95"
            style={{ backgroundColor: currentUser.color }}
          >
            Set My Time →
          </button>
        </div>
      )}
    </div>
  );
}

// ── Suggestion card ────────────────────────────────────────────────────────────

interface SuggestionCardProps {
  block: SuggestionBlock;
  currentUser: UserProfile;
  onRequest: (friend: Friend) => void;
}

function SuggestionCard({ block, onRequest }: SuggestionCardProps) {
  const { friends, date, startSlot, endSlot } = block;
  const topFriend = friends[0];
  const extra     = friends.length - 1;
  const dateLabel = friendlyDate(date);
  const isPopular = friends.length >= 2;

  return (
    <div
      className="bg-white rounded-3xl p-4 shadow-sm flex items-center gap-3"
      style={{ borderLeft: `5px solid ${topFriend.color}` }}
    >
      {/* Friend avatars */}
      <div className="flex -space-x-3 flex-shrink-0">
        {friends.slice(0, 3).map((f) => (
          <div
            key={f.uid}
            className="w-10 h-10 rounded-full flex items-center justify-center text-xl border-2 border-white"
            style={{ backgroundColor: f.color + '44' }}
          >
            {f.emoji}
          </div>
        ))}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 mb-0.5">
          {isPopular && (
            <span className="text-xs font-black text-yellow-600 bg-yellow-100 rounded-lg px-1.5 py-0.5">
              🌟 Popular
            </span>
          )}
        </div>
        <p className="font-black text-gray-800 text-sm leading-tight">
          {friends.map((f) => f.displayName).join(' & ')}
        </p>
        <p className="text-xs text-gray-500 font-semibold">
          {dateLabel} · {formatTime(startSlot)}–{formatTime(endSlot)}
        </p>
      </div>

      {/* Invite button — if single friend invite them directly, else pick first */}
      <button
        onClick={() => onRequest(topFriend)}
        className="px-3 py-2 rounded-2xl font-black text-white text-xs flex-shrink-0 active:scale-95 transition-transform"
        style={{ backgroundColor: topFriend.color }}
      >
        Invite!
      </button>

      {extra > 0 && (
        <span className="text-xs text-gray-400 font-bold flex-shrink-0">+{extra}</span>
      )}
    </div>
  );
}

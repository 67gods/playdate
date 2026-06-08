import { useState } from 'react';
import type { Friend, FriendRequest, UserProfile } from '../types';
import AvailabilityGrid from '../components/AvailabilityGrid';
import TimeSlotPicker from '../components/TimeSlotPicker';

interface Props {
  currentUser: UserProfile;
  friends: Friend[];
  pendingRequests: FriendRequest[];
  onSearch: (username: string) => Promise<UserProfile | null>;
  onSendFriendRequest: (toUser: UserProfile) => Promise<void>;
  onAcceptFriendRequest: (request: FriendRequest) => Promise<void>;
  onRemoveFriendship: (otherUid: string) => Promise<void>;
  onRequestPlaydate: (friend: Friend) => void;
}

export default function FriendsScreen({
  currentUser,
  friends,
  pendingRequests,
  onSearch,
  onSendFriendRequest,
  onAcceptFriendRequest,
  onRemoveFriendship,
  onRequestPlaydate,
}: Props) {
  const [query, setQuery] = useState('');
  const [searchResult, setSearchResult] = useState<UserProfile | null | 'not-found'>(null);
  const [searching, setSearching] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const [expandedFriend, setExpandedFriend] = useState<string | null>(null);
  const [detailView, setDetailView] = useState<'grid' | 'detail'>('grid');
  const [removing, setRemoving] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState<string | null>(null);

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setSearchResult(null);
    const result = await onSearch(query.trim().toLowerCase());
    setSearchResult(result ?? 'not-found');
    setSearching(false);
  }

  async function handleAddFriend(user: UserProfile) {
    setSendingTo(user.uid);
    try {
      await onSendFriendRequest(user);
      setSentTo(prev => new Set(prev).add(user.uid));
    } finally {
      setSendingTo(null);
    }
  }

  async function handleRemove(otherUid: string) {
    setRemoving(otherUid);
    try {
      await onRemoveFriendship(otherUid);
      setSentTo(prev => {
        const next = new Set(prev);
        next.delete(otherUid);
        return next;
      });
      setConfirmingRemove(null);
    } finally {
      setRemoving(null);
    }
  }

  const incomingFriendReqs = pendingRequests.filter(
    (r) => r.toUid === currentUser.uid && r.status === 'pending'
  );

  // UIDs where current user already sent an outgoing request
  const outgoingRequestUids = new Set(
    pendingRequests
      .filter(r => r.fromUid === currentUser.uid && r.status === 'pending')
      .map(r => r.toUid)
  );

  return (
    <div>
      <h1 className="font-black text-2xl text-gray-800 mb-1">👥 Friends</h1>
      <p className="text-gray-500 font-semibold mb-5">Find friends by username</p>

      {/* Search */}
      <div className="flex gap-2 mb-5">
        <div className="flex-1 flex items-center bg-white rounded-2xl shadow-sm border-2 border-gray-100 overflow-hidden">
          <span className="pl-4 text-gray-400 font-bold">@</span>
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSearchResult(null); }}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="username..."
            className="flex-1 px-2 py-3 font-bold text-gray-700 focus:outline-none bg-transparent"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={searching || !query.trim()}
          className="px-5 py-3 rounded-2xl font-black text-white shadow-sm active:scale-95 transition-transform disabled:opacity-40"
          style={{ backgroundColor: currentUser.color }}
        >
          {searching ? '⏳' : '🔍'}
        </button>
      </div>

      {/* Search result */}
      {searchResult && searchResult !== 'not-found' && (
        <div className="bg-white rounded-3xl p-4 shadow-sm mb-5">
          <div className="flex items-center gap-3">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-3xl"
              style={{ backgroundColor: searchResult.color + '33' }}
            >
              {searchResult.emoji}
            </div>
            <div className="flex-1">
              <p className="font-black text-gray-800 text-lg">{searchResult.displayName}</p>
              <p className="text-gray-500 font-semibold">@{searchResult.username}</p>
            </div>
            {searchResult.uid === currentUser.uid ? (
              <span className="text-gray-400 font-bold text-sm">That's you!</span>
            ) : friends.some((f) => f.uid === searchResult.uid) ? (
              <span className="text-green-600 font-bold text-sm">✅ Friends</span>
            ) : sentTo.has(searchResult.uid) || outgoingRequestUids.has(searchResult.uid) ? (
              <div className="flex items-center gap-2">
                <span className="text-green-600 font-bold text-sm">✅ Sent!</span>
                <button
                  onClick={() => handleRemove(searchResult.uid)}
                  disabled={removing === searchResult.uid}
                  className="px-3 py-2 rounded-2xl font-black text-gray-500 bg-gray-100 text-sm active:scale-95 transition-transform disabled:opacity-60"
                >
                  {removing === searchResult.uid ? '⏳' : '✕ Cancel'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleAddFriend(searchResult as UserProfile)}
                disabled={sendingTo === searchResult.uid}
                className="px-4 py-2 rounded-2xl font-black text-white text-sm active:scale-95 transition-transform disabled:opacity-60"
                style={{ backgroundColor: searchResult.color }}
              >
                {sendingTo === searchResult.uid ? '⏳' : 'Add!'}
              </button>
            )}
          </div>
        </div>
      )}
      {searchResult === 'not-found' && (
        <div className="text-center py-4 mb-5 bg-white rounded-3xl shadow-sm">
          <p className="text-2xl mb-1">🤷</p>
          <p className="font-bold text-gray-500">No one found with @{query}</p>
        </div>
      )}

      {/* Incoming friend requests */}
      {incomingFriendReqs.length > 0 && (
        <div className="mb-5">
          <h2 className="font-black text-gray-700 text-lg mb-3">🤝 Friend Requests</h2>
          {incomingFriendReqs.map((req) => (
            <div key={req.id} className="bg-white rounded-3xl p-3 shadow-sm mb-2 flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
                style={{ backgroundColor: req.fromColor + '33' }}
              >
                {req.fromEmoji}
              </div>
              <div className="flex-1">
                <p className="font-black text-gray-800">{req.fromDisplayName}</p>
                <p className="text-gray-500 text-sm font-semibold">@{req.fromUsername}</p>
              </div>
              <button
                onClick={() => handleRemove(req.fromUid)}
                disabled={removing === req.fromUid}
                className="px-3 py-2 rounded-2xl font-black text-gray-500 bg-gray-100 text-sm active:scale-95 transition-transform disabled:opacity-60"
              >
                {removing === req.fromUid ? '⏳' : 'Decline'}
              </button>
              <button
                onClick={() => onAcceptFriendRequest(req)}
                className="px-4 py-2 rounded-2xl font-black text-white text-sm active:scale-95 transition-transform"
                style={{ backgroundColor: req.fromColor }}
              >
                Accept!
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Friends list */}
      <h2 className="font-black text-gray-700 text-lg mb-3">My Friends ({friends.length})</h2>

      {friends.length === 0 ? (
        <div className="text-center py-8 bg-white rounded-3xl shadow-sm">
          <p className="text-5xl mb-2">👻</p>
          <p className="font-black text-gray-600">No friends yet!</p>
          <p className="text-gray-400 font-semibold text-sm">Search for someone above</p>
        </div>
      ) : (
        friends.map((friend) => {
          const isExpanded = expandedFriend === friend.uid;
          const totalSlots = Object.values(friend.availability).reduce(
            (s, arr) => s + (arr?.length ?? 0), 0
          );
          return (
            <div key={friend.uid} className="bg-white rounded-3xl shadow-sm mb-3 overflow-hidden">
              {/* Collapsed header */}
              <button
                className="w-full flex items-center gap-3 p-4 active:bg-gray-50 transition-colors"
                onClick={() => {
                  setExpandedFriend(isExpanded ? null : friend.uid);
                  setDetailView('grid');
                }}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ backgroundColor: friend.color + '33' }}
                >
                  {friend.emoji}
                </div>
                <div className="flex-1 text-left">
                  <p className="font-black text-gray-800">{friend.displayName}</p>
                  <p className="text-xs text-gray-400 font-semibold">
                    @{friend.username} · {totalSlots > 0 ? `${totalSlots} free slots` : 'no availability set'}
                  </p>
                </div>
                <span className="text-gray-400">{isExpanded ? '▲' : '▼'}</span>
              </button>

              {/* Expanded: heatmap + detail toggle */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-100">
                  {/* View toggle */}
                  <div className="flex gap-2 my-3">
                    <button
                      onClick={() => setDetailView('grid')}
                      className={`flex-1 py-2 rounded-2xl font-black text-xs transition-all ${
                        detailView === 'grid' ? 'text-white' : 'bg-gray-100 text-gray-500'
                      }`}
                      style={detailView === 'grid' ? { backgroundColor: friend.color } : {}}
                    >
                      Week overview
                    </button>
                    <button
                      onClick={() => setDetailView('detail')}
                      className={`flex-1 py-2 rounded-2xl font-black text-xs transition-all ${
                        detailView === 'detail' ? 'text-white' : 'bg-gray-100 text-gray-500'
                      }`}
                      style={detailView === 'detail' ? { backgroundColor: friend.color } : {}}
                    >
                      Detailed slots
                    </button>
                  </div>

                  {detailView === 'grid' ? (
                    <AvailabilityGrid availability={friend.availability} color={friend.color} />
                  ) : (
                    <TimeSlotPicker
                      availability={friend.availability}
                      color={friend.color}
                      readonly
                      friendAvailability={currentUser.availability}
                      friendColor={currentUser.color}
                    />
                  )}

                  <button
                    onClick={() => onRequestPlaydate(friend)}
                    className="mt-4 w-full py-3 rounded-2xl font-black text-white text-sm active:scale-95 transition-transform"
                    style={{ backgroundColor: friend.color }}
                  >
                    🎉 Request Playdate!
                  </button>

                  {confirmingRemove === friend.uid ? (
                    <div className="mt-2 flex items-center justify-center gap-2 text-sm">
                      <span className="font-bold text-gray-500">Remove @{friend.username}?</span>
                      <button
                        onClick={() => handleRemove(friend.uid)}
                        disabled={removing === friend.uid}
                        className="px-3 py-1.5 rounded-2xl font-black text-white bg-red-400 active:scale-95 transition-transform disabled:opacity-60"
                      >
                        {removing === friend.uid ? '⏳' : 'Yes'}
                      </button>
                      <button
                        onClick={() => setConfirmingRemove(null)}
                        className="px-3 py-1.5 rounded-2xl font-black text-gray-500 bg-gray-100 active:scale-95 transition-transform"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmingRemove(friend.uid)}
                      className="mt-2 w-full py-2 rounded-2xl font-bold text-red-400 text-sm active:scale-95 transition-transform"
                    >
                      Remove friend
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

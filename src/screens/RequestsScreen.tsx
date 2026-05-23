import { useState } from 'react';
import type { Playdate, UserProfile } from '../types';
import PlaydateCard from '../components/PlaydateCard';

interface Props {
  currentUser: UserProfile;
  playdates: Playdate[];
  onConfirm: (id: string) => Promise<void>;
  onDecline: (id: string) => Promise<void>;
}

export default function RequestsScreen({ currentUser, playdates, onConfirm, onDecline }: Props) {
  const [tab, setTab] = useState<'incoming' | 'outgoing'>('incoming');

  const incoming = playdates.filter((p) => p.recipientId === currentUser.uid);
  const outgoing = playdates.filter((p) => p.requesterId === currentUser.uid);

  const shown = tab === 'incoming' ? incoming : outgoing;
  const pendingIncoming = incoming.filter((p) => p.status === 'pending').length;

  return (
    <div>
      <h1 className="font-black text-2xl text-gray-800 mb-4">📬 Requests</h1>

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
          <p className="text-5xl mb-3">{tab === 'incoming' ? '📭' : '✉️'}</p>
          <p className="font-black text-gray-600 text-lg">
            {tab === 'incoming' ? 'No requests yet!' : 'You haven\'t sent any requests yet!'}
          </p>
          <p className="text-gray-400 font-semibold text-sm mt-1">
            {tab === 'incoming'
              ? 'When friends invite you, they\'ll show up here'
              : 'Go to Friends and invite someone!'}
          </p>
        </div>
      ) : (
        shown.map((pd) => (
          <PlaydateCard
            key={pd.id}
            playdate={pd}
            currentUser={currentUser}
            onConfirm={onConfirm}
            onDecline={onDecline}
          />
        ))
      )}
    </div>
  );
}

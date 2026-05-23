import type { Screen, UserProfile } from '../types';

interface Props {
  currentUser: UserProfile;
  screen: Screen;
  navigate: (s: Screen) => void;
  children: React.ReactNode;
  badgeCount?: number;
  friendsBadgeCount?: number;
  onEditProfile: () => void;
}

const TABS: { screen: Screen; icon: string; label: string }[] = [
  { screen: 'home', icon: '🏠', label: 'Home' },
  { screen: 'availability', icon: '📅', label: 'My Time' },
  { screen: 'friends', icon: '👥', label: 'Friends' },
  { screen: 'requests', icon: '📬', label: 'Requests' },
];

export default function Layout({ currentUser, screen, navigate, children, badgeCount, friendsBadgeCount, onEditProfile }: Props) {
  return (
    <div className="flex flex-col h-full max-w-md mx-auto">
      {/* Top bar — tap to edit profile */}
      <button
        onClick={onEditProfile}
        className="flex items-center gap-3 px-5 py-4 safe-top w-full text-left active:brightness-90 transition-all"
        style={{ backgroundColor: currentUser.color }}
      >
        <div className="w-10 h-10 rounded-full bg-white/30 flex items-center justify-center text-xl flex-shrink-0">
          {currentUser.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-white text-lg leading-none">{currentUser.displayName}</p>
          <p className="text-white/70 text-xs font-semibold">@{currentUser.username}</p>
        </div>
        <span className="text-white/60 text-sm font-bold">✏️ Edit</span>
      </button>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24">{children}</div>

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-100 safe-bottom">
        <div className="flex">
          {TABS.map((tab) => {
            const active = screen === tab.screen;
            const tabBadge =
              tab.screen === 'requests' ? (badgeCount ?? 0) :
              tab.screen === 'friends'  ? (friendsBadgeCount ?? 0) : 0;
            return (
              <button
                key={tab.screen}
                onClick={() => navigate(tab.screen)}
                className={`flex-1 flex flex-col items-center py-2 gap-0.5 transition-all active:scale-95 focus:outline-none relative ${
                  active ? 'opacity-100' : 'opacity-40'
                }`}
              >
                <span className="text-2xl">{tab.icon}</span>
                <span
                  className="text-xs font-black"
                  style={{ color: active ? currentUser.color : undefined }}
                >
                  {tab.label}
                </span>
                {tabBadge > 0 && (
                  <span className="absolute top-1 right-3 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">
                    {tabBadge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

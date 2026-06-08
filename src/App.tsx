import { useEffect, useState, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { apiFetch } from './lib/api';
import type { Day, Friend, FriendRequest, Playdate, Screen, UserProfile } from './types';
import AuthScreen from './screens/AuthScreen';
import Layout from './components/Layout';
import SetupScreen from './screens/SetupScreen';
import HomeScreen from './screens/HomeScreen';
import AvailabilityScreen from './screens/AvailabilityScreen';
import FriendsScreen from './screens/FriendsScreen';
import RequestsScreen from './screens/RequestsScreen';
import RequestPlaydateModal from './components/RequestPlaydateModal';
import ProfileEditModal from './components/ProfileEditModal';

export default function App() {
  const { authUser, loading: authLoading, logout, refreshAuth } = useAuth();

  const [currentUser, setCurrentUser]         = useState<UserProfile | null>(null);
  const [screen, setScreen]                   = useState<Screen>('home');
  const [friends, setFriends]                 = useState<Friend[]>([]);
  const [playdates, setPlaydates]             = useState<Playdate[]>([]);
  const [friendRequests, setFriendRequests]   = useState<FriendRequest[]>([]);
  const [requestModal, setRequestModal]       = useState<{ friend: Friend; prefill?: { date: string; timeSlots: string[] } } | null>(null);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [dataLoading, setDataLoading]         = useState(false);

  useEffect(() => {
    if (!authUser?.username) {
      setCurrentUser(null);
      setFriends([]);
      setPlaydates([]);
      setFriendRequests([]);
      return;
    }

    setCurrentUser({
      uid:               authUser.uid,
      username:          authUser.username,
      displayName:       authUser.displayName ?? '',
      color:             authUser.color ?? '#4D96FF',
      emoji:             authUser.emoji ?? '🦁',
      parentModeEnabled: authUser.parentModeEnabled ?? false,
      availability:      (authUser.availability ?? {}) as Partial<Record<Day, string[]>>,
    });

    setDataLoading(true);
    Promise.all([
      apiFetch<Friend[]>('/api/friends'),
      apiFetch<Playdate[]>('/api/playdates'),
      apiFetch<FriendRequest[]>('/api/friends/requests'),
    ])
      .then(([f, p, fr]) => {
        setFriends(f);
        setPlaydates(p);
        setFriendRequests(fr);
      })
      .catch(console.error)
      .finally(() => setDataLoading(false));
  }, [authUser]);

  const refreshFriends = useCallback(async () => {
    const [f, fr] = await Promise.all([
      apiFetch<Friend[]>('/api/friends'),
      apiFetch<FriendRequest[]>('/api/friends/requests'),
    ]);
    setFriends(f);
    setFriendRequests(fr);
  }, []);

  const refreshPlaydates = useCallback(async () => {
    const p = await apiFetch<Playdate[]>('/api/playdates');
    setPlaydates(p);
  }, []);

  const handleSetupComplete = useCallback(
    async (profile: Omit<UserProfile, 'uid'>) => {
      await apiFetch('/api/users/setup', {
        method: 'POST',
        body: JSON.stringify(profile),
      });
      await refreshAuth();
    },
    [refreshAuth]
  );

  const handleUpdateProfile = useCallback(
    async (updates: Partial<Omit<UserProfile, 'uid' | 'availability'>>) => {
      const updated = await apiFetch<UserProfile>('/api/users/me', {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      setCurrentUser(updated);
      await refreshAuth();
    },
    [refreshAuth]
  );

  const handleSaveAvailability = useCallback(
    async (day: Day, slots: string[]) => {
      if (!currentUser) return;
      const updated: Partial<Record<Day, string[]>> = { ...currentUser.availability, [day]: slots };
      setCurrentUser((prev) => prev && { ...prev, availability: updated });
      await apiFetch('/api/users/me/availability', {
        method: 'PUT',
        body: JSON.stringify({ day, slots }),
      });
    },
    [currentUser]
  );

  const handleSearch = useCallback(async (username: string): Promise<UserProfile | null> => {
    try {
      return await apiFetch<UserProfile>(`/api/users/search?u=${encodeURIComponent(username)}`);
    } catch {
      return null;
    }
  }, []);

  const handleSendFriendRequest = useCallback(
    async (toUser: UserProfile) => {
      await apiFetch('/api/friends/request', {
        method: 'POST',
        body: JSON.stringify({ toUserId: toUser.uid }),
      });
      await refreshFriends();
    },
    [refreshFriends]
  );

  const handleAcceptFriendRequest = useCallback(
    async (request: FriendRequest) => {
      await apiFetch(`/api/friends/accept/${request.id}`, { method: 'POST' });
      await refreshFriends();
    },
    [refreshFriends]
  );

  const handleRemoveFriendship = useCallback(
    async (otherUid: string) => {
      await apiFetch(`/api/friends/${otherUid}`, { method: 'DELETE' });
      await refreshFriends();
    },
    [refreshFriends]
  );

  const handleSendPlaydateRequest = useCallback(
    async (data: { type: 'playdate' | 'meeting'; date: string; timeSlots: string[]; message: string }) => {
      if (!requestModal) return;
      await apiFetch('/api/playdates', {
        method: 'POST',
        body: JSON.stringify({ recipientId: requestModal.friend.uid, ...data }),
      });
      setRequestModal(null);
      await refreshPlaydates();
    },
    [requestModal, refreshPlaydates]
  );

  const handleConfirmPlaydate = useCallback(
    async (id: string) => {
      await apiFetch(`/api/playdates/${id}/confirm`, { method: 'POST' });
      await refreshPlaydates();
    },
    [refreshPlaydates]
  );

  const handleDeclinePlaydate = useCallback(
    async (id: string) => {
      await apiFetch(`/api/playdates/${id}/decline`, { method: 'POST' });
      await refreshPlaydates();
    },
    [refreshPlaydates]
  );

  const handleSignOut = useCallback(async () => {
    await logout();
    setEditProfileOpen(false);
    setCurrentUser(null);
  }, [logout]);

  const pendingIncoming = playdates.filter(
    (p) => p.recipientId === authUser?.uid && p.status === 'pending'
  ).length;

  const incomingFriendReqs = friendRequests.filter(
    (r) => r.toUid === authUser?.uid && r.status === 'pending'
  );

  if (authLoading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFF8F0]">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">🎉</div>
          <p className="font-black text-gray-500 text-xl">Loading PlayDate...</p>
        </div>
      </div>
    );
  }

  if (!authUser) return <AuthScreen />;

  if (!authUser.username || !currentUser) {
    return <SetupScreen onComplete={handleSetupComplete} onSignOut={handleSignOut} />;
  }

  const screenProps = { currentUser, navigate: setScreen };

  return (
    <>
      <Layout
        currentUser={currentUser}
        screen={screen}
        navigate={setScreen}
        badgeCount={pendingIncoming}
        friendsBadgeCount={incomingFriendReqs.length}
        onEditProfile={() => setEditProfileOpen(true)}
      >
        {screen === 'home' && (
          <HomeScreen
            {...screenProps}
            friends={friends}
            playdates={playdates}
            onRequestPlaydate={(friend, prefill) => setRequestModal({ friend, prefill })}
          />
        )}
        {screen === 'availability' && (
          <AvailabilityScreen {...screenProps} onSaveDay={handleSaveAvailability} />
        )}
        {screen === 'friends' && (
          <FriendsScreen
            {...screenProps}
            friends={friends}
            pendingRequests={friendRequests}
            onSearch={handleSearch}
            onSendFriendRequest={handleSendFriendRequest}
            onAcceptFriendRequest={handleAcceptFriendRequest}
            onRemoveFriendship={handleRemoveFriendship}
            onRequestPlaydate={(friend) => setRequestModal({ friend })}
          />
        )}
        {screen === 'requests' && (
          <RequestsScreen
            {...screenProps}
            playdates={playdates}
            onConfirm={handleConfirmPlaydate}
            onDecline={handleDeclinePlaydate}
          />
        )}
      </Layout>

      {requestModal && (
        <RequestPlaydateModal
          friend={requestModal.friend}
          currentUser={currentUser}
          prefill={requestModal.prefill}
          onSubmit={handleSendPlaydateRequest}
          onClose={() => setRequestModal(null)}
        />
      )}

      {editProfileOpen && (
        <ProfileEditModal
          currentUser={currentUser}
          onSave={handleUpdateProfile}
          onClose={() => setEditProfileOpen(false)}
          onSignOut={handleSignOut}
        />
      )}
    </>
  );
}

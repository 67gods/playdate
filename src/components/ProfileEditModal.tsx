import { useState } from 'react';
import type { UserProfile } from '../types';
import ColorPicker from './ColorPicker';
import EmojiPicker from './EmojiPicker';

interface Props {
  currentUser: UserProfile;
  onSave: (updates: Partial<Omit<UserProfile, 'uid' | 'availability'>>) => Promise<void>;
  onClose: () => void;
  onSignOut: () => void;
}

export default function ProfileEditModal({ currentUser, onSave, onClose, onSignOut }: Props) {
  const [displayName, setDisplayName] = useState(currentUser.displayName);
  const [color, setColor] = useState(currentUser.color);
  const [emoji, setEmoji] = useState(currentUser.emoji);
  const [username, setUsername] = useState(currentUser.username);
  const [parentMode, setParentMode] = useState(currentUser.parentModeEnabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const usernameClean = username.toLowerCase().replace(/[^a-z0-9_]/g, '');

  const changed =
    displayName.trim() !== currentUser.displayName ||
    color !== currentUser.color ||
    emoji !== currentUser.emoji ||
    usernameClean !== currentUser.username ||
    parentMode !== currentUser.parentModeEnabled;

  async function handleSave() {
    setError('');
    if (displayName.trim().length < 2) {
      setError('Name must be at least 2 letters!');
      return;
    }
    if (usernameClean.length < 3) {
      setError('Username must be at least 3 characters!');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        displayName: displayName.trim(),
        color,
        emoji,
        username: usernameClean,
        parentModeEnabled: parentMode,
      });
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again!');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-[#FFF8F0] rounded-t-3xl w-full max-w-md max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1.5 rounded-full bg-gray-300" />
        </div>

        {/* Live preview */}
        <div
          className="mx-4 mt-2 mb-5 rounded-3xl p-4 flex items-center gap-3"
          style={{ backgroundColor: color }}
        >
          <div className="w-14 h-14 rounded-full bg-white/30 flex items-center justify-center text-3xl">
            {emoji}
          </div>
          <div>
            <p className="font-black text-white text-xl leading-tight">
              {displayName.trim() || '...'}
            </p>
            <p className="text-white/70 text-sm font-semibold">@{usernameClean || '...'}</p>
          </div>
        </div>

        <div className="px-4 pb-8 flex flex-col gap-5">
          {/* Name */}
          <div>
            <label className="font-black text-gray-700 block mb-2">Your Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={20}
              className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-700 bg-white focus:outline-none focus:border-blue-400"
            />
          </div>

          {/* Username */}
          <div>
            <label className="font-black text-gray-700 block mb-1">Username</label>
            <p className="text-xs text-gray-400 font-semibold mb-2">
              Changing this won't break existing friends
            </p>
            <div className="flex items-center bg-white rounded-2xl border-2 border-gray-200 overflow-hidden focus-within:border-blue-400">
              <span className="pl-4 text-gray-400 font-bold text-lg">@</span>
              <input
                type="text"
                value={usernameClean}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={20}
                className="flex-1 px-2 py-3 font-bold text-gray-700 bg-transparent focus:outline-none"
              />
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="font-black text-gray-700 block mb-3">Your Color</label>
            <ColorPicker value={color} onChange={setColor} />
          </div>

          {/* Emoji */}
          <div>
            <label className="font-black text-gray-700 block mb-3">Your Animal</label>
            <EmojiPicker value={emoji} onChange={setEmoji} />
          </div>

          {/* Parent mode */}
          <div className="bg-white rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-black text-gray-800">👨‍👩‍👧 Parent Approval</p>
                <p className="text-xs text-gray-500 font-semibold mt-0.5">
                  Parents must OK each playdate
                </p>
              </div>
              <button
                onClick={() => setParentMode(!parentMode)}
                className="w-12 h-7 rounded-full transition-colors relative flex-shrink-0"
                style={{ backgroundColor: parentMode ? color : '#D1D5DB' }}
              >
                <div
                  className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                    parentMode ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>

          {error && <p className="text-red-500 font-bold text-sm text-center">{error}</p>}

          {/* Save / Cancel */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-4 rounded-3xl font-black text-gray-500 bg-white shadow-sm active:scale-95 transition-transform"
            >
              Cancel
            </button>
            <button
              disabled={!changed || saving || displayName.trim().length < 2 || usernameClean.length < 3}
              onClick={handleSave}
              className="flex-1 py-4 rounded-3xl font-black text-white text-lg shadow-lg active:scale-95 transition-transform disabled:opacity-30"
              style={{ backgroundColor: color }}
            >
              {saving ? '⏳' : 'Save!'}
            </button>
          </div>

          {/* Sign out */}
          <button
            onClick={onSignOut}
            className="w-full py-3 rounded-3xl font-black text-red-400 border-2 border-red-100 bg-white active:scale-95 transition-transform"
          >
            🚪 Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

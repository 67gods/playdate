import { useState } from 'react';
import type { UserProfile } from '../types';
import { KID_COLORS, KID_EMOJIS } from '../constants';
import ColorPicker from '../components/ColorPicker';
import EmojiPicker from '../components/EmojiPicker';

interface Props {
  onComplete: (profile: Omit<UserProfile, 'uid'>) => Promise<void>;
  onSignOut: () => Promise<void>;
}

type Step = 'name' | 'look' | 'username' | 'done';

export default function SetupScreen({ onComplete, onSignOut }: Props) {
  const [step, setStep] = useState<Step>('name');
  const [displayName, setDisplayName] = useState('');
  const [color, setColor] = useState(KID_COLORS[4].value);
  const [emoji, setEmoji] = useState(KID_EMOJIS[0]);
  const [username, setUsername] = useState('');
  const [parentMode, setParentMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const usernameClean = username.toLowerCase().replace(/[^a-z0-9_]/g, '');

  async function handleFinish() {
    setError('');
    if (!usernameClean || usernameClean.length < 3) {
      setError('Username must be at least 3 letters!');
      return;
    }
    setSaving(true);
    try {
      await onComplete({
        username: usernameClean,
        displayName: displayName.trim(),
        color,
        emoji,
        parentModeEnabled: parentMode,
        availability: {},
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again!');
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative" style={{ backgroundColor: color + '22' }}>
      <button
        onClick={onSignOut}
        className="absolute top-4 right-4 px-3 py-2 rounded-full bg-white/80 font-bold text-gray-600 text-sm shadow-sm active:scale-95 transition-transform"
      >
        Sign out
      </button>
      <div className="w-full max-w-sm">
        {/* Progress dots */}
        <div className="flex gap-2 justify-center mb-8">
          {(['name', 'look', 'username'] as Step[]).map((s, i) => (
            <div
              key={s}
              className="w-3 h-3 rounded-full transition-all"
              style={{ backgroundColor: step === s || (i < ['name', 'look', 'username'].indexOf(step)) ? color : '#D1D5DB' }}
            />
          ))}
        </div>

        {step === 'name' && (
          <div className="text-center">
            <div className="text-6xl mb-4">{emoji}</div>
            <h1 className="text-3xl font-black text-gray-800 mb-2">Hi there! 👋</h1>
            <p className="text-gray-500 font-semibold mb-6">What's your name?</p>
            <input
              autoFocus
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name..."
              maxLength={20}
              className="w-full text-center text-2xl font-black border-0 border-b-4 bg-transparent py-3 focus:outline-none"
              style={{ borderBottomColor: color, color: color }}
            />
            <button
              disabled={displayName.trim().length < 2}
              onClick={() => setStep('look')}
              className="mt-8 w-full py-4 rounded-3xl font-black text-white text-xl shadow-lg active:scale-95 transition-transform disabled:opacity-30"
              style={{ backgroundColor: color }}
            >
              Next →
            </button>
          </div>
        )}

        {step === 'look' && (
          <div>
            <h1 className="text-3xl font-black text-gray-800 mb-1 text-center">
              Hey {displayName}! 🎨
            </h1>
            <p className="text-gray-500 font-semibold mb-5 text-center">Pick your color and animal</p>

            <div className="bg-white rounded-3xl p-5 shadow-sm mb-4">
              <p className="font-black text-gray-700 mb-3 text-center">Your Color</p>
              <ColorPicker value={color} onChange={setColor} />
            </div>

            <div className="bg-white rounded-3xl p-5 shadow-sm mb-6">
              <p className="font-black text-gray-700 mb-3 text-center">Your Animal</p>
              <EmojiPicker value={emoji} onChange={setEmoji} />
            </div>

            {/* Preview */}
            <div
              className="flex items-center gap-3 rounded-3xl p-4 mb-6"
              style={{ backgroundColor: color }}
            >
              <div className="w-14 h-14 rounded-full bg-white/30 flex items-center justify-center text-3xl">
                {emoji}
              </div>
              <p className="font-black text-white text-xl">{displayName}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('name')}
                className="flex-1 py-4 rounded-3xl font-black text-gray-500 bg-white shadow-sm active:scale-95 transition-transform"
              >
                ← Back
              </button>
              <button
                onClick={() => setStep('username')}
                className="flex-1 py-4 rounded-3xl font-black text-white shadow-lg active:scale-95 transition-transform"
                style={{ backgroundColor: color }}
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {step === 'username' && (
          <div className="text-center">
            <div className="text-6xl mb-3">{emoji}</div>
            <h1 className="text-2xl font-black text-gray-800 mb-1">Almost ready!</h1>
            <p className="text-gray-500 font-semibold mb-6">
              Pick a username so friends can find you
            </p>

            <div className="flex items-center bg-white rounded-2xl shadow-sm border-2 mb-2 overflow-hidden"
              style={{ borderColor: color }}>
              <span className="pl-4 text-gray-400 font-bold text-lg">@</span>
              <input
                autoFocus
                type="text"
                value={usernameClean}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="coolkid123"
                maxLength={20}
                className="flex-1 px-2 py-4 text-lg font-black focus:outline-none bg-transparent"
                style={{ color: color }}
              />
            </div>
            <p className="text-xs text-gray-400 font-semibold mb-4">
              Letters, numbers, and _ only • At least 3 characters
            </p>

            {/* Parent mode toggle */}
            <div className="bg-white rounded-2xl p-4 shadow-sm mb-6 text-left">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-black text-gray-800">👨‍👩‍👧 Parent Approval</p>
                  <p className="text-xs text-gray-500 font-semibold mt-0.5">
                    Parents must OK each playdate
                  </p>
                </div>
                <button
                  onClick={() => setParentMode(!parentMode)}
                  className={`w-12 h-7 rounded-full transition-colors relative ${parentMode ? '' : 'bg-gray-200'}`}
                  style={parentMode ? { backgroundColor: color } : {}}
                >
                  <div
                    className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                      parentMode ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>

            {error && (
              <p className="text-red-500 font-bold text-sm mb-3">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep('look')}
                className="flex-1 py-4 rounded-3xl font-black text-gray-500 bg-white shadow-sm active:scale-95 transition-transform"
              >
                ← Back
              </button>
              <button
                disabled={usernameClean.length < 3 || saving}
                onClick={handleFinish}
                className="flex-1 py-4 rounded-3xl font-black text-white text-lg shadow-lg active:scale-95 transition-transform disabled:opacity-30"
                style={{ backgroundColor: color }}
              >
                {saving ? '⏳' : "Let's Go! 🚀"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

declare global {
  interface Window {
    handleGoogleCredential?: (response: { credential: string }) => void;
    google?: {
      accounts: {
        id: {
          initialize: (opts: object) => void;
          renderButton: (el: HTMLElement, opts: object) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export default function AuthScreen() {
  const { login } = useAuth();
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleCredential = async ({ credential }: { credential: string }) => {
      setError('');
      setLoading(true);
      try {
        await login(credential);
      } catch {
        setError('Sign-in failed. Try again!');
        setLoading(false);
      }
    };
    window.handleGoogleCredential = handleCredential;

    const script   = document.createElement('script');
    script.src     = 'https://accounts.google.com/gsi/client';
    script.async   = true;
    script.onload  = () => {
      window.google?.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback:  handleCredential,
      });
      const btn = document.getElementById('google-btn');
      if (btn) {
        window.google?.accounts.id.renderButton(btn, {
          theme: 'outline',
          size:  'large',
          width: 340,
        });
      }
      window.google?.accounts.id.prompt();
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
      delete window.handleGoogleCredential;
    };
  }, [login]);

  return (
    <div className="min-h-screen bg-[#FFF8F0] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-7xl mb-3">🎉</div>
          <h1 className="text-4xl font-black text-gray-800">PlayDate</h1>
          <p className="text-gray-500 font-semibold mt-1">Schedule fun with your friends!</p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm text-center">
          <p className="font-black text-gray-700 mb-5">Sign in to get started</p>

          {loading ? (
            <div className="text-4xl animate-bounce">⏳</div>
          ) : (
            <div id="google-btn" className="flex justify-center" />
          )}

          {error && (
            <p className="text-red-500 font-bold text-sm mt-4">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}

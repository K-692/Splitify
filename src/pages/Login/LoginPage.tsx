import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthContext';
import { Button } from '@/components/common/Button';
import { CheckCircle2 } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { user, signInWithGoogle, signInWithDemoPersona, loading } = useAuth();
  const navigate = useNavigate();
  const [authError, setAuthError] = useState<string | null>(null);

  React.useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleGoogleLogin = async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
      navigate('/');
    } catch (err: any) {
      console.error(err);
      setAuthError(err.message || 'Failed to authenticate with Google. Please try again.');
    }
  };

  const handleDemoPersona = async (persona: 'krish' | 'rahul' | 'priya') => {
    try {
      await signInWithDemoPersona(persona);
      navigate('/');
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-[#15263C] rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 p-8 sm:p-10 transition-all text-center">
        {/* Official Splitify Logo */}
        <div className="w-24 h-24 mx-auto mb-6 rounded-3xl overflow-hidden shadow-md bg-[#203D62] p-1.5 flex items-center justify-center">
          <img
            src="./assets/splitify-logo.png"
            alt="Splitify Logo"
            className="w-full h-full object-contain"
          />
        </div>

        <h1 className="text-3xl font-black text-[#203D62] dark:text-white tracking-tight">
          Split<span className="text-teal-500">ify</span>
        </h1>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mt-2">
          Collaborative Expense Splitting for Trips, Roommates & Friends
        </p>

        {authError && (
          <div className="mt-4 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold text-left">
            {authError}
          </div>
        )}

        {/* Primary Google Login Button */}
        <div className="mt-8 space-y-4">
          <Button
            onClick={handleGoogleLogin}
            isLoading={loading}
            variant="secondary"
            size="lg"
            className="w-full !rounded-2xl py-3.5 shadow-lg bg-[#203D62] hover:bg-[#192f4c] text-white flex items-center justify-center gap-3 font-extrabold text-sm border border-slate-700/30"
          >
            {/* Google G logo svg */}
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Continue with Google
          </Button>

          {/* Persona quick logins */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
              Or Try With Instant Demo Persona
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleDemoPersona('krish')}
                className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-950/30 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-teal-600 dark:hover:text-teal-400 transition-all flex flex-col items-center gap-1.5"
              >
                <div className="w-8 h-8 rounded-full bg-teal-500 text-white font-bold flex items-center justify-center text-xs">
                  KP
                </div>
                <span>Krishnendu</span>
              </button>
              <button
                type="button"
                onClick={() => handleDemoPersona('rahul')}
                className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-950/30 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-teal-600 dark:hover:text-teal-400 transition-all flex flex-col items-center gap-1.5"
              >
                <div className="w-8 h-8 rounded-full bg-[#F36B2C] text-white font-bold flex items-center justify-center text-xs">
                  RS
                </div>
                <span>Rahul</span>
              </button>
              <button
                type="button"
                onClick={() => handleDemoPersona('priya')}
                className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-950/30 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-teal-600 dark:hover:text-teal-400 transition-all flex flex-col items-center gap-1.5"
              >
                <div className="w-8 h-8 rounded-full bg-[#203D62] text-white font-bold flex items-center justify-center text-xs">
                  PP
                </div>
                <span>Priya</span>
              </button>
            </div>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-left space-y-2 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-teal-500 flex-shrink-0" />
            <span>Automatic integer-precise financial balance calculation</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-teal-500 flex-shrink-0" />
            <span>Hierarchical items, subitems, and audit history</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-teal-500 flex-shrink-0" />
            <span>Debt simplification & one-click 💸 Settled! flow</span>
          </div>
        </div>
      </div>
    </div>
  );
};

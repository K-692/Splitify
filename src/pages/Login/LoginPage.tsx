import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthContext';
import { Button } from '@/components/common/Button';
import { CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { user, signInWithGoogle, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [authError, setAuthError] = useState<string | null>(null);

  const getDestination = () => {
    const fromState = (location.state as any)?.from;
    const sessionTarget = sessionStorage.getItem('splitify_auth_redirect');
    const target = fromState || sessionTarget || '/';
    if (sessionTarget) sessionStorage.removeItem('splitify_auth_redirect');
    return target;
  };

  React.useEffect(() => {
    if (user) {
      navigate(getDestination(), { replace: true });
    }
  }, [user, navigate]);

  const handleGoogleLogin = async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
      navigate(getDestination(), { replace: true });
    } catch (err: any) {
      console.error(err);
      setAuthError(err.message || 'Failed to authenticate with Google. Please try again.');
    }
  };

  const isUnauthorizedDomain =
    Boolean(authError && authError.toLowerCase().includes('unauthorized-domain'));

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-[#15263C] rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 p-8 sm:p-10 transition-all text-center">
        {/* Official Splitify Logo (No circular frame) */}
        <div className="w-48 sm:w-56 mx-auto mb-3 flex items-center justify-center">
          <img
            src={`${import.meta.env.BASE_URL}assets/splitify-logo.png`}
            alt="Splitify Logo"
            className="w-full h-auto max-h-24 object-contain"
          />
        </div>

        {/* Tagline right after logo (no Splitify text) */}
        <p className="text-sm sm:text-base font-bold text-slate-600 dark:text-slate-300 max-w-xs mx-auto leading-relaxed">
          Collaborative Expense Splitting for Trips, Roommates & Friends
        </p>

        {/* Error Alert Display */}
        {authError && (
          <div className="mt-5 text-left">
            {isUnauthorizedDomain ? (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs font-semibold space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-500" />
                  <span>Domain Authorization Required in Firebase</span>
                </div>
                <p className="leading-relaxed">
                  Google Sign-In is blocked because <code className="bg-amber-500/20 px-1.5 py-0.5 rounded font-mono font-bold text-amber-950 dark:text-amber-100">{window.location.hostname}</code> is not in your Firebase authorized domains list.
                </p>
                <div className="pt-1">
                  <a
                    href="https://console.firebase.google.com/project/splitify-151bd/authentication/settings"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-teal-600 dark:text-teal-400 font-extrabold hover:underline"
                  >
                    <span>Add domain in Firebase Console Settings</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                {authError}
              </div>
            )}
          </div>
        )}

        {/* Primary Google Login Button */}
        <div className="mt-8">
          <Button
            onClick={handleGoogleLogin}
            isLoading={loading}
            variant="secondary"
            size="lg"
            leftIcon={
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
            }
            className="w-full !rounded-2xl py-3.5 shadow-lg bg-[#203D62] hover:bg-[#192f4c] text-white font-extrabold text-sm border border-slate-700/30 flex items-center justify-center gap-3"
          >
            Continue with Google
          </Button>
        </div>

        {/* Feature Highlights */}
        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-left space-y-2.5 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-teal-500 flex-shrink-0" />
            <span>Automatic integer-precise financial balance calculation</span>
          </div>
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-teal-500 flex-shrink-0" />
            <span>Hierarchical items, subitems, and discrepancy notes</span>
          </div>
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-teal-500 flex-shrink-0" />
            <span>Debt simplification & one-click 💸 Settled! flow</span>
          </div>
        </div>
      </div>
    </div>
  );
};

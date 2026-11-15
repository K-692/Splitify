import React, { useState } from 'react';
import { useAuth } from '@/app/providers/AuthContext';
import { ShieldCheck, Info, ChevronDown, ChevronUp, Users } from 'lucide-react';

export const FirebaseSetupBanner: React.FC = () => {
  const { isFirebaseConnected, user, signInWithDemoPersona } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);

  if (isFirebaseConnected) {
    return null; // Production Firebase configured smoothly
  }

  return (
    <div className="bg-gradient-to-r from-teal-500/10 via-[#203D62]/10 to-amber-500/10 border-b border-teal-500/20 text-slate-700 dark:text-slate-300 text-xs py-2 px-4 transition-all">
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 font-bold text-teal-600 dark:text-teal-400 bg-teal-100 dark:bg-teal-900/40 px-2 py-0.5 rounded-full">
            <Info className="w-3.5 h-3.5" />
            Interactive Demo Mode
          </span>
          <span className="hidden sm:inline">
            Splitify is running with interactive real-time multi-user simulation.
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-white/70 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 px-1.5 flex items-center gap-1">
              <Users className="w-3 h-3" /> Test as:
            </span>
            <button
              onClick={() => signInWithDemoPersona('krish')}
              className={`px-2 py-0.5 rounded-lg font-bold text-[11px] transition-colors ${
                user?.username === 'krish'
                  ? 'bg-teal-500 text-white shadow-sm'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              Krish
            </button>
            <button
              onClick={() => signInWithDemoPersona('rahul')}
              className={`px-2 py-0.5 rounded-lg font-bold text-[11px] transition-colors ${
                user?.username === 'rahul'
                  ? 'bg-teal-500 text-white shadow-sm'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              Rahul
            </button>
            <button
              onClick={() => signInWithDemoPersona('priya')}
              className={`px-2 py-0.5 rounded-lg font-bold text-[11px] transition-colors ${
                user?.username === 'priya'
                  ? 'bg-teal-500 text-white shadow-sm'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              Priya
            </button>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 rounded-lg text-slate-600 dark:text-slate-300"
            title="Toggle Firebase setup info"
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="max-w-6xl mx-auto mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-slate-600 dark:text-slate-400">
          <div className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-teal-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                To connect your live Firebase project (<code>splitify-151bd</code>):
              </p>
              <p className="mt-1">
                Create a <code>.env</code> file from <code>.env.example</code> with your Firebase Web App credentials:
                <code className="mx-1 bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">
                  VITE_FIREBASE_API_KEY
                </code>
                ,
                <code className="mx-1 bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">
                  VITE_FIREBASE_APP_ID
                </code>
                . In Firebase Console, ensure Google Authentication and Cloud Firestore are enabled, and add your domain to Authorized Domains.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

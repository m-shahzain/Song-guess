import React, { useEffect, useState } from 'react';
import { Trophy, Medal, Sparkles, X, RefreshCw, CheckCircle2, Database, RotateCcw } from 'lucide-react';
import { fetchTopLeaderboard, LeaderboardEntry, isSupabaseConfigured, resetAllScores } from '../lib/supabase';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  highlightUsername?: string;
  recentScore?: number;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  onClose,
  highlightUsername,
  recentScore,
}) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    const data = await fetchTopLeaderboard();
    setEntries(data);
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div 
        className="relative w-full max-w-lg bg-[#130728] border border-pink-500/30 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-pink-900/40 text-white overflow-hidden"
      >
        {/* Ambient glow backgrounds */}
        <div className="absolute -top-24 -left-24 w-60 h-60 bg-pink-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-purple-800/60 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-pink-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Trophy className="w-5 h-5 text-slate-950 font-bold" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-pink-300 to-amber-200">
                Global Hall of Fame
              </h2>
              <div className="flex items-center gap-2 text-xs text-purple-300/80">
                <span>Top Bollywood Masters</span>
                <span aria-hidden="true">·</span>
                <span className="flex items-center gap-1 text-[11px]">
                  <Database className="w-3 h-3 text-pink-400" />
                  {isSupabaseConfigured ? 'Supabase Live' : 'Local + Offline Sync'}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-purple-300 hover:text-white hover:bg-purple-900/40 rounded-lg transition-colors"
            aria-label="Close leaderboard"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status banner */}
        {!isSupabaseConfigured && (
          <div className="mt-3 py-2 px-3 bg-purple-950/60 border border-purple-700/40 rounded-lg text-xs text-purple-200 flex items-center justify-between">
            <span>Ready for Supabase! Add <code className="text-pink-300">VITE_SUPABASE_URL</code> to enable cloud sync.</span>
            <span className="text-[11px] text-amber-400 font-semibold px-2 py-0.5 rounded bg-amber-500/10">Active</span>
          </div>
        )}

        {/* Content list */}
        <div className="mt-4 max-h-80 overflow-y-auto pr-1 space-y-2 relative z-10">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-purple-400 gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-pink-500" />
              <span className="text-sm">Fetching Bollywood maestros...</span>
            </div>
          ) : entries.length === 0 ? (
            <div className="py-12 text-center text-purple-300 text-sm">
              No scores recorded yet. Be the first to claim the throne!
            </div>
          ) : (
            entries.map((item, index) => {
              const isCurrentUser =
                highlightUsername &&
                item.username.toLowerCase() === highlightUsername.toLowerCase() &&
                (recentScore === undefined || item.score === recentScore);

              const isTop3 = index < 3;
              const rankStyles = [
                'bg-gradient-to-r from-amber-500/20 to-amber-900/10 border-amber-500/40 text-amber-300',
                'bg-gradient-to-r from-slate-400/20 to-slate-800/10 border-slate-400/40 text-slate-200',
                'bg-gradient-to-r from-amber-700/20 to-amber-950/10 border-amber-700/40 text-amber-500',
              ];

              return (
                <div
                  key={`${item.username}-${index}-${item.score}`}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border transition-all ${
                    isCurrentUser
                      ? 'border-pink-500 bg-pink-500/20 shadow-md shadow-pink-500/20 font-bold'
                      : isTop3
                      ? rankStyles[index]
                      : 'bg-purple-950/30 border-purple-800/30 text-purple-200 hover:border-purple-700/50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 text-center font-mono font-bold text-sm">
                      {index === 0 ? '👑' : `#${index + 1}`}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate flex items-center gap-1.5 text-white">
                        {item.username}
                        {isCurrentUser && (
                          <span className="text-[10px] uppercase font-bold text-pink-300 bg-pink-500/30 px-1.5 py-0.5 rounded">
                            You
                          </span>
                        )}
                      </p>
                      {item.created_at && (
                        <p className="text-[11px] text-purple-400 truncate">
                          {new Date(item.created_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pl-3 shrink-0">
                    <div className="text-right">
                      <span className="font-mono text-base font-black text-amber-300">
                        {item.score}
                      </span>
                      <span className="text-[11px] text-purple-400 ml-1">pts</span>
                    </div>
                    {isTop3 && (
                      <Medal
                        className={`w-4 h-4 ${
                          index === 0
                            ? 'text-amber-400'
                            : index === 1
                            ? 'text-slate-300'
                            : 'text-amber-600'
                        }`}
                      />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="mt-5 pt-4 border-t border-purple-800/60 flex items-center justify-between text-xs text-purple-300">
          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              className="flex items-center gap-1.5 hover:text-white text-purple-400 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
            <button
              onClick={async () => {
                setIsLoading(true);
                const fresh = await resetAllScores();
                setEntries(fresh);
                setIsLoading(false);
              }}
              className="flex items-center gap-1 text-purple-400 hover:text-amber-300 transition-colors text-[11px] cursor-pointer"
              title="Reset scores so highest is 45 and all others are < 45 and > 10"
            >
              <RotateCcw className="w-3 h-3 text-pink-400" />
              Reset Scores
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-medium rounded-xl transition-all shadow-md shadow-pink-600/20 cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Support both Vite (VITE_) and Next.js style (NEXT_PUBLIC_) environment variables
const supabaseUrl = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_URL) ||
  '';

const supabaseAnonKey = 
  (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_SUPABASE_ANON_KEY || import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env?.VITE_SUPABASE_KEY)) ||
  (typeof process !== 'undefined' && (process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env?.NEXT_PUBLIC_SUPABASE_KEY)) ||
  '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'MY_SUPABASE_URL' && 
  !supabaseUrl.includes('placeholder')
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export interface LeaderboardEntry {
  id?: string | number;
  username: string;
  score: number;
  created_at?: string;
}

// Fallback storage key for local offline/development mode (v3 for reset scores: highest 45, others < 45 and > 10)
const LOCAL_STORAGE_KEY = 'bollywood_quiz_leaderboard_cache_v3';

export const INITIAL_FALLBACK_LEADERBOARD: LeaderboardEntry[] = [
  { id: '1', username: 'Shahzain', score: 45, created_at: new Date(Date.now() - 3600000 * 2).toISOString() },
  { id: '2', username: 'Rahim', score: 40, created_at: new Date(Date.now() - 3600000 * 4).toISOString() },
  { id: '3', username: 'Saad', score: 35, created_at: new Date(Date.now() - 3600000 * 8).toISOString() },
  { id: '4', username: 'Muiz', score: 30, created_at: new Date(Date.now() - 3600000 * 12).toISOString() },
  { id: '5', username: 'Awais', score: 25, created_at: new Date(Date.now() - 3600000 * 16).toISOString() },
  { id: '6', username: 'Simran_DDLJ', score: 20, created_at: new Date(Date.now() - 3600000 * 20).toISOString() },
  { id: '7', username: 'Bunny_YJHD', score: 18, created_at: new Date(Date.now() - 3600000 * 24).toISOString() },
  { id: '8', username: 'Kabir_Grooves', score: 15, created_at: new Date(Date.now() - 3600000 * 28).toISOString() },
  { id: '9', username: 'Poo_K3G', score: 14, created_at: new Date(Date.now() - 3600000 * 32).toISOString() },
  { id: '10', username: 'Geet_Bhatia', score: 12, created_at: new Date(Date.now() - 3600000 * 36).toISOString() },
];

/**
 * Resets all scores locally and in Supabase if configured.
 * Highest score is 45, all others are < 45 and > 10.
 */
export async function resetAllScores(): Promise<LeaderboardEntry[]> {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('bollywood_quiz_leaderboard_cache');
      localStorage.removeItem('bollywood_quiz_leaderboard_cache_v2');
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(INITIAL_FALLBACK_LEADERBOARD));
    } catch {}
  }

  if (supabase) {
    try {
      for (const entry of INITIAL_FALLBACK_LEADERBOARD) {
        await supabase
          .from('leaderboard')
          .upsert({ username: entry.username, score: entry.score }, { onConflict: 'username' });
      }
    } catch (err) {
      console.warn('Error resetting Supabase scores:', err);
    }
  }

  return INITIAL_FALLBACK_LEADERBOARD;
}

export async function fetchTopLeaderboard(): Promise<LeaderboardEntry[]> {
  // Purge any outdated cache versions
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('bollywood_quiz_leaderboard_cache');
      localStorage.removeItem('bollywood_quiz_leaderboard_cache_v2');
    } catch {}
  }

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('leaderboard')
        .select('*')
        .order('score', { ascending: false })
        .limit(10);

      if (error) {
        console.warn('Supabase fetch error, using local storage fallback:', error.message);
      } else if (data && data.length > 0) {
        // If Supabase contains scores above 45 or <= 10 from previous sessions, re-align
        const hasOutdatedScores = data.some((item) => item.score > 45 || item.score <= 10);
        if (hasOutdatedScores) {
          try {
            await resetAllScores();
            return INITIAL_FALLBACK_LEADERBOARD;
          } catch (resetErr) {
            console.warn('Could not reset Supabase rows:', resetErr);
          }
        }
        return data as LeaderboardEntry[];
      }
    } catch (err) {
      console.warn('Supabase connection failed, using local storage fallback:', err);
    }
  }

  // Fallback to localStorage
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Check if any entries violate the reset rule (highest 45, others < 45 and > 10)
        const hasOutdatedScores = parsed.some((item) => item.score > 45 || item.score <= 10);
        if (!hasOutdatedScores) {
          return parsed.sort((a, b) => b.score - a.score).slice(0, 10);
        }
      }
    }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(INITIAL_FALLBACK_LEADERBOARD));
    return INITIAL_FALLBACK_LEADERBOARD;
  } catch {
    return INITIAL_FALLBACK_LEADERBOARD;
  }
}

/**
 * Fetch an existing player's current total score from Supabase or localStorage
 */
export async function getPlayerCurrentScore(username: string): Promise<number | null> {
  const cleanName = username.trim();
  if (!cleanName) return null;

  if (supabase) {
    try {
      const { data } = await supabase
        .from('leaderboard')
        .select('score')
        .ilike('username', cleanName)
        .order('score', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data && typeof data.score === 'number') {
        if (data.score > 45 || data.score <= 10) {
          const fallbackMatch = INITIAL_FALLBACK_LEADERBOARD.find(
            (item) => item.username.toLowerCase() === cleanName.toLowerCase()
          );
          return fallbackMatch ? fallbackMatch.score : null;
        }
        return data.score;
      }
    } catch (err) {
      console.warn('Could not query player score from Supabase:', err);
    }
  }

  // Check localStorage
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const list: LeaderboardEntry[] = JSON.parse(raw);
      const match = list.find((item) => item.username.toLowerCase() === cleanName.toLowerCase());
      if (match) {
        if (match.score > 45 || match.score <= 10) {
          const fallbackMatch = INITIAL_FALLBACK_LEADERBOARD.find(
            (item) => item.username.toLowerCase() === cleanName.toLowerCase()
          );
          return fallbackMatch ? fallbackMatch.score : null;
        }
        return match.score;
      }
    }
  } catch {}

  const fallbackMatch = INITIAL_FALLBACK_LEADERBOARD.find(
    (item) => item.username.toLowerCase() === cleanName.toLowerCase()
  );
  return fallbackMatch ? fallbackMatch.score : null;
}

export async function submitLeaderboardScore(
  username: string, 
  pointsToAdd: number
): Promise<{ success: boolean; newTotalScore: number; previousScore: number; isExistingUser: boolean; message?: string }> {
  const cleanName = username.trim().slice(0, 20) || 'Anonymous DJ';
  let recordedInSupabase = false;
  let previousScore = 0;
  let isExistingUser = false;

  // 1. Try Supabase
  if (supabase) {
    try {
      // Check if user already exists
      const { data: existingRows } = await supabase
        .from('leaderboard')
        .select('id, username, score')
        .ilike('username', cleanName)
        .limit(1);

      if (existingRows && existingRows.length > 0) {
        isExistingUser = true;
        previousScore = Number(existingRows[0].score || 0);
        const newTotal = previousScore + pointsToAdd;

        const { error: updateError } = await supabase
          .from('leaderboard')
          .update({ score: newTotal, created_at: new Date().toISOString() })
          .eq('id', existingRows[0].id);

        if (!updateError) {
          recordedInSupabase = true;
        } else {
          console.warn('Supabase update warning:', updateError.message);
        }
      } else {
        // Insert brand new player
        const { error: insertError } = await supabase
          .from('leaderboard')
          .insert([{ username: cleanName, score: pointsToAdd }]);

        if (!insertError) {
          recordedInSupabase = true;
        } else {
          console.warn('Supabase insert warning:', insertError.message);
        }
      }
    } catch (err) {
      console.warn('Supabase operation failed, updating locally:', err);
    }
  }

  // 2. LocalStorage persistence & synchronization
  let newTotal = pointsToAdd;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    let list: LeaderboardEntry[] = raw ? JSON.parse(raw) : [...INITIAL_FALLBACK_LEADERBOARD];
    if (!Array.isArray(list) || list.length === 0 || list.some((item) => item.score > 45 || item.score <= 10)) {
      list = [...INITIAL_FALLBACK_LEADERBOARD];
    }
    
    const existingIndex = list.findIndex(
      (item) => item.username.toLowerCase() === cleanName.toLowerCase()
    );

    if (existingIndex >= 0) {
      isExistingUser = true;
      previousScore = Number(list[existingIndex].score || 0);
      newTotal = previousScore + pointsToAdd;
      list[existingIndex] = {
        ...list[existingIndex],
        username: cleanName,
        score: newTotal,
        created_at: new Date().toISOString(),
      };
    } else {
      newTotal = pointsToAdd;
      list.push({
        id: `loc_${Date.now()}`,
        username: cleanName,
        score: newTotal,
        created_at: new Date().toISOString(),
      });
    }

    list = list.sort((a, b) => b.score - a.score).slice(0, 25);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.error('Failed to update local leaderboard:', err);
  }

  return {
    success: true,
    newTotalScore: newTotal,
    previousScore,
    isExistingUser,
    message: recordedInSupabase
      ? (isExistingUser ? `Added ${pointsToAdd} pts to your previous score in Supabase!` : 'Saved to Supabase!')
      : (isExistingUser ? `Added ${pointsToAdd} pts to your previous score!` : 'Saved to leaderboard!')
  };
}

export interface LeaderboardStats {
  entries: LeaderboardEntry[];
  userRank: number | null;
  userTotalScore: number | null;
  isInTop3: boolean;
  scoreNeededForTop3: number;
  isInTop10: boolean;
  scoreNeededForTop10: number;
  top3Score: number;
  top10Score: number;
}

export async function fetchLeaderboardStats(username: string, overrideScore?: number): Promise<LeaderboardStats> {
  const cleanName = username.trim().toLowerCase();
  const topList = await fetchTopLeaderboard();

  // Find user's score (prefer overrideScore if freshly calculated)
  const userScore = overrideScore !== undefined 
    ? overrideScore 
    : ((await getPlayerCurrentScore(username)) ?? 0);

  // If user is in topList, update their score in the topList copy if overrideScore is newer
  let effectiveTopList = [...topList];
  const userIdxInTop = effectiveTopList.findIndex((item) => item.username.toLowerCase() === cleanName);
  if (userIdxInTop >= 0 && overrideScore !== undefined) {
    effectiveTopList[userIdxInTop] = {
      ...effectiveTopList[userIdxInTop],
      score: Math.max(effectiveTopList[userIdxInTop].score, userScore),
    };
    effectiveTopList.sort((a, b) => b.score - a.score);
  }

  let userRank: number | null = null;
  const userIdx = effectiveTopList.findIndex((item) => item.username.toLowerCase() === cleanName);
  
  if (userIdx >= 0) {
    userRank = userIdx + 1;
  } else if (cleanName) {
    // If not in top 10, calculate rank from Supabase or localStorage
    if (supabase) {
      try {
        const { count, error } = await supabase
          .from('leaderboard')
          .select('*', { count: 'exact', head: true })
          .gt('score', userScore);

        if (!error && typeof count === 'number') {
          userRank = count + 1;
        }
      } catch (err) {
        console.warn('Rank count failed:', err);
      }
    }

    if (userRank === null) {
      try {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (raw) {
          const allList: LeaderboardEntry[] = JSON.parse(raw);
          const allSorted = allList.sort((a, b) => b.score - a.score);
          const foundIdx = allSorted.findIndex((it) => it.username.toLowerCase() === cleanName);
          if (foundIdx >= 0) {
            userRank = foundIdx + 1;
          } else {
            // If user has a score, calculate virtual rank
            const higherCount = allSorted.filter((it) => it.score > userScore).length;
            userRank = higherCount + 1;
          }
        }
      } catch {}
    }
  }

  // 3rd place score (to enter top 3, user must exceed this or match)
  const top3Score = effectiveTopList.length >= 3 ? effectiveTopList[2].score : 0;
  // 10th place score (to enter top 10, user must exceed this or match)
  const top10Score = effectiveTopList.length >= 10 ? effectiveTopList[9].score : 0;

  const isInTop3 = Boolean(userRank !== null && userRank <= 3);
  const isInTop10 = Boolean(userRank !== null && userRank <= 10);

  const scoreNeededForTop3 = isInTop3 ? 0 : Math.max(1, top3Score - userScore + 1);
  const scoreNeededForTop10 = isInTop10 ? 0 : Math.max(1, top10Score - userScore + 1);

  return {
    entries: effectiveTopList,
    userRank,
    userTotalScore: userScore,
    isInTop3,
    scoreNeededForTop3,
    isInTop10,
    scoreNeededForTop10,
    top3Score,
    top10Score,
  };
}


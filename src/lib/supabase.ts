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

// Fallback storage key for local offline/development mode (v2 for updated names)
const LOCAL_STORAGE_KEY = 'bollywood_quiz_leaderboard_cache_v2';

const INITIAL_FALLBACK_LEADERBOARD: LeaderboardEntry[] = [
  { id: '1', username: 'Shahzain', score: 95, created_at: new Date(Date.now() - 3600000 * 2).toISOString() },
  { id: '2', username: 'Rahim', score: 85, created_at: new Date(Date.now() - 3600000 * 4).toISOString() },
  { id: '3', username: 'Saad', score: 75, created_at: new Date(Date.now() - 3600000 * 8).toISOString() },
  { id: '4', username: 'Muiz', score: 65, created_at: new Date(Date.now() - 3600000 * 12).toISOString() },
  { id: '5', username: 'Awais', score: 55, created_at: new Date(Date.now() - 3600000 * 16).toISOString() },
  { id: '6', username: 'Simran_DDLJ', score: 45, created_at: new Date(Date.now() - 3600000 * 20).toISOString() },
  { id: '7', username: 'Bunny_YJHD', score: 40, created_at: new Date(Date.now() - 3600000 * 24).toISOString() },
  { id: '8', username: 'Kabir_Grooves', score: 35, created_at: new Date(Date.now() - 3600000 * 28).toISOString() },
  { id: '9', username: 'Poo_K3G', score: 30, created_at: new Date(Date.now() - 3600000 * 32).toISOString() },
  { id: '10', username: 'Geet_Bhatia', score: 25, created_at: new Date(Date.now() - 3600000 * 36).toISOString() },
];

export async function fetchTopLeaderboard(): Promise<LeaderboardEntry[]> {
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
        return parsed.sort((a, b) => b.score - a.score).slice(0, 10);
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
      if (match) return match.score;
    }
  } catch {}

  return null;
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

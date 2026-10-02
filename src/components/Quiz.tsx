import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { 
  Play, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Trophy, 
  Music, 
  Sparkles, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Flame, 
  Radio, 
  AlertCircle,
  Headphones,
  Share2,
  Check,
  User,
  Medal,
  Target,
  Crown,
  Database,
  RefreshCw,
  LogOut
} from 'lucide-react';
import { motion } from 'motion/react';
import { 
  fetchBollywoodSongs, 
  generateQuizRounds, 
  iTunesTrack, 
  QuizQuestion, 
  PLAYLIST_CATEGORIES 
} from '../lib/itunes';
import { 
  playCorrectSound, 
  playWrongSound, 
  playVictorySound, 
  isSoundEffectsEnabled, 
  setSoundEffectsEnabled 
} from '../lib/soundEffects';
import { 
  submitLeaderboardScore, 
  getPlayerCurrentScore,
  fetchLeaderboardStats,
  LeaderboardStats,
  isSupabaseConfigured
} from '../lib/supabase';
import { LeaderboardModal } from './LeaderboardModal';

const AUDIO_PREVIEW_SECONDS = 5.0; // Song plays for 5 seconds
const GUESS_TIMER_SECONDS = 10.0;   // 10-second timer to guess after song finishes
const FEEDBACK_DELAY_MS = 1800;    // 1.8s feedback delay to show highlighted answer
const TOTAL_QUESTIONS = 10;

export const Quiz: React.FC = () => {
  // Category / Songs data
  const [selectedCategory, setSelectedCategory] = useState<string>('Bollywood');
  const [songsPool, setSongsPool] = useState<iTunesTrack[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [isLoadingSongs, setIsLoadingSongs] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Game state
  const [gameState, setGameState] = useState<'intro' | 'playing' | 'feedback' | 'finished'>('intro');
  const [score, setScore] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [maxStreak, setMaxStreak] = useState<number>(0);
  
  // Timer & Phase state:
  // 'listening' = song is playing for 5s (can guess immediately or wait)
  // 'guessing' = 10s countdown timer is actively draining
  // 'feedback' = answer shown (correct highlighted, timeout message, etc.)
  const [quizPhase, setQuizPhase] = useState<'listening' | 'guessing' | 'feedback'>('listening');
  const [timeLeft, setTimeLeft] = useState<number>(GUESS_TIMER_SECONDS);
  const [audioTimeLeft, setAudioTimeLeft] = useState<number>(AUDIO_PREVIEW_SECONDS);
  
  // Answer selection state (Anti-cheat: correct is only evaluated in memory)
  const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);
  const [lastAnswerWasCorrect, setLastAnswerWasCorrect] = useState<boolean | null>(null);

  // Audio elements & timers
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerAnimationRef = useRef<number | null>(null);
  const audioAnimationRef = useRef<number | null>(null);
  const timerBarRef = useRef<HTMLDivElement | null>(null);
  const lastTenthRef = useRef<number>(-1);
  const lastAudioTenthRef = useRef<number>(-1);
  const audioTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const guessTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const roundStartTimeRef = useRef<number>(0);
  const audioStartTimeRef = useRef<number>(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [audioAutoplayBlocked, setAudioAutoplayBlocked] = useState<boolean>(false);
  const [soundMuted, setSoundMuted] = useState<boolean>(!isSoundEffectsEnabled());

  // Ref to hold handleAnswerSelection to avoid stale closure in timer callbacks
  const handleAnswerSelectionRef = useRef<(chosenTrackId: number | null, isTimeout?: boolean) => void>(() => {});

  // Player Name and pre-game input state
  const [playerName, setPlayerName] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('bollywood_quiz_player_name') || '';
    }
    return '';
  });
  const [nameError, setNameError] = useState<string | null>(null);
  const [previousScore, setPreviousScore] = useState<number | null>(null);

  // Leaderboard & game completion state
  const [submissionResult, setSubmissionResult] = useState<{
    newTotalScore: number;
    previousScore: number;
    isExistingUser: boolean;
  } | null>(null);
  const [leaderboardStats, setLeaderboardStats] = useState<LeaderboardStats | null>(null);
  const [isFinishingGame, setIsFinishingGame] = useState<boolean>(false);
  const [leaderboardModalOpen, setLeaderboardModalOpen] = useState<boolean>(false);
  const [shareCopied, setShareCopied] = useState<boolean>(false);

  // Check if player name exists when playerName changes
  useEffect(() => {
    let isSubscribed = true;
    const checkName = async () => {
      const clean = playerName.trim();
      if (clean.length >= 2) {
        const existing = await getPlayerCurrentScore(clean);
        if (isSubscribed) {
          setPreviousScore(existing);
        }
      } else {
        if (isSubscribed) {
          setPreviousScore(null);
        }
      }
    };
    const timer = setTimeout(checkName, 250);
    return () => {
      isSubscribed = false;
      clearTimeout(timer);
    };
  }, [playerName]);

  // Load songs on mount or when category changes
  const loadSongsForCategory = useCallback(async (categoryQuery: string) => {
    setIsLoadingSongs(true);
    setLoadError(null);
    try {
      const tracks = await fetchBollywoodSongs(categoryQuery);
      if (!tracks || tracks.length < 10) {
        throw new Error('Could not load sufficient tracks. Please try again.');
      }
      setSongsPool(tracks);
    } catch {
      setLoadError('Failed to fetch songs from iTunes. Using Bollywood backup catalog.');
    } finally {
      setIsLoadingSongs(false);
    }
  }, []);

  useEffect(() => {
    loadSongsForCategory(selectedCategory);
  }, [selectedCategory, loadSongsForCategory]);

  // Cleanup timers & audio
  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = '';
    }
    setIsPlayingAudio(false);
    if (audioTimeoutRef.current) {
      clearTimeout(audioTimeoutRef.current);
      audioTimeoutRef.current = null;
    }
    if (guessTimeoutRef.current) {
      clearTimeout(guessTimeoutRef.current);
      guessTimeoutRef.current = null;
    }
    if (timerAnimationRef.current) {
      cancelAnimationFrame(timerAnimationRef.current);
      timerAnimationRef.current = null;
    }
    if (audioAnimationRef.current) {
      cancelAnimationFrame(audioAnimationRef.current);
      audioAnimationRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopAudio();
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, [stopAudio]);

  // Start the 10-second guessing countdown timer (starts immediately after the 5s song finishes)
  const start10SecondGuessTimer = useCallback(() => {
    // Ensure audio is stopped when 5s completes
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlayingAudio(false);

    setQuizPhase('guessing');
    setTimeLeft(GUESS_TIMER_SECONDS);
    lastTenthRef.current = Math.round(GUESS_TIMER_SECONDS * 10);
    roundStartTimeRef.current = performance.now();

    // Reset bar to 100% full at the moment guessing starts
    if (timerBarRef.current) {
      timerBarRef.current.style.width = '100%';
    }

    // 10-second safety timeout
    if (guessTimeoutRef.current) clearTimeout(guessTimeoutRef.current);
    guessTimeoutRef.current = setTimeout(() => {
      setTimeLeft(0);
      if (timerBarRef.current) {
        timerBarRef.current.style.width = '0%';
      }
      handleAnswerSelectionRef.current(null, true);
    }, GUESS_TIMER_SECONDS * 1000);

    // Silky smooth 60-120 FPS progress bar update:
    // 1) Direct DOM style.width update runs on every animation frame without CSS transition lag or jitter
    // 2) React state is updated only when the 0.1s display digit changes, saving 83% of vDOM re-renders
    const updateGuessProgress = () => {
      const elapsedMs = performance.now() - roundStartTimeRef.current;
      const remainingSeconds = Math.max(0, GUESS_TIMER_SECONDS - elapsedMs / 1000);
      const percentage = Math.max(0, Math.min(100, (remainingSeconds / GUESS_TIMER_SECONDS) * 100));

      if (timerBarRef.current) {
        timerBarRef.current.style.width = `${percentage}%`;
      }

      const currentTenth = Math.round(remainingSeconds * 10);
      if (currentTenth !== lastTenthRef.current) {
        lastTenthRef.current = currentTenth;
        setTimeLeft(remainingSeconds);
      }

      if (remainingSeconds > 0) {
        timerAnimationRef.current = requestAnimationFrame(updateGuessProgress);
      } else {
        setTimeLeft(0);
        if (timerBarRef.current) {
          timerBarRef.current.style.width = '0%';
        }
        handleAnswerSelectionRef.current(null, true);
      }
    };

    if (timerAnimationRef.current) cancelAnimationFrame(timerAnimationRef.current);
    timerAnimationRef.current = requestAnimationFrame(updateGuessProgress);
  }, []);

  // Start a new round: plays song for 5 seconds, then launches the 10-second guessing timer
  const startTimerAndAudio = useCallback((previewUrl: string) => {
    stopAudio();
    setQuizPhase('listening');
    setTimeLeft(GUESS_TIMER_SECONDS); // 10.0s primed
    setAudioTimeLeft(AUDIO_PREVIEW_SECONDS); // 5.0s
    lastAudioTenthRef.current = Math.round(AUDIO_PREVIEW_SECONDS * 10);
    setAudioAutoplayBlocked(false);

    if (timerBarRef.current) {
      timerBarRef.current.style.width = '100%';
    }

    // Setup HTML Audio
    const audio = new Audio(previewUrl);
    audio.preload = 'auto';
    audio.volume = 1.0;
    audioRef.current = audio;

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsPlayingAudio(true);
          setAudioAutoplayBlocked(false);
        })
        .catch((err) => {
          console.warn('Browser prevented autoplay:', err);
          setIsPlayingAudio(false);
          setAudioAutoplayBlocked(true);
        });
    }

    audioStartTimeRef.current = performance.now();

    // 5-second countdown for the song clip
    const updateAudioProgress = () => {
      const elapsedMs = performance.now() - audioStartTimeRef.current;
      const remainingAudio = Math.max(0, AUDIO_PREVIEW_SECONDS - elapsedMs / 1000);

      const currentAudioTenth = Math.round(remainingAudio * 10);
      if (currentAudioTenth !== lastAudioTenthRef.current) {
        lastAudioTenthRef.current = currentAudioTenth;
        setAudioTimeLeft(remainingAudio);
      }

      if (remainingAudio > 0) {
        audioAnimationRef.current = requestAnimationFrame(updateAudioProgress);
      } else {
        setAudioTimeLeft(0);
        // The song has finished playing for 5 seconds! Now start the 10s guessing timer
        start10SecondGuessTimer();
      }
    };

    if (audioAnimationRef.current) cancelAnimationFrame(audioAnimationRef.current);
    audioAnimationRef.current = requestAnimationFrame(updateAudioProgress);
  }, [stopAudio, start10SecondGuessTimer]);

  // Core Game Initialization
  const handleStartGame = useCallback(() => {
    if (songsPool.length < 10) return;
    try {
      const generatedRounds = generateQuizRounds(songsPool, TOTAL_QUESTIONS);
      setQuestions(generatedRounds);
      setCurrentQuestionIndex(0);
      setScore(0);
      setStreak(0);
      setMaxStreak(0);
      setSelectedTrackId(null);
      setLastAnswerWasCorrect(null);
      setSubmissionResult(null);
      setLeaderboardStats(null);
      setGameState('playing');

      // Play first round audio
      setTimeout(() => {
        startTimerAndAudio(generatedRounds[0].correctTrack.previewUrl);
      }, 100);
    } catch (err) {
      console.error('Error starting game:', err);
      setLoadError('Failed to prepare quiz rounds. Please refresh and try again.');
    }
  }, [songsPool, startTimerAndAudio]);

  // Handle start from the pre-game name input panel
  const handleStartGameWithName = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = playerName.trim();
    if (!clean) {
      setNameError('Please enter your name to start!');
      return;
    }
    setNameError(null);
    if (typeof window !== 'undefined') {
      localStorage.setItem('bollywood_quiz_player_name', clean);
    }
    handleStartGame();
  };

  // User manual audio unlock if browser blocks auto-play
  const handleManualPlayAudio = () => {
    if (audioRef.current) {
      audioRef.current.play().then(() => {
        setIsPlayingAudio(true);
        setAudioAutoplayBlocked(false);
      }).catch(console.error);
    }
  };

  // Process game completion: save score and fetch leaderboard rank analysis
  const processGameCompletion = async (finalRoundScore: number) => {
    setIsFinishingGame(true);
    const cleanName = playerName.trim() || 'Bollywood Fan';
    try {
      // 1. Submit score (adds to previous total if played before)
      const res = await submitLeaderboardScore(cleanName, finalRoundScore);
      setSubmissionResult(res);
      setPreviousScore(res.newTotalScore);

      // 2. Fetch fresh leaderboard stats including rank, top 3 gap, top 10 gap
      const stats = await fetchLeaderboardStats(cleanName, res.newTotalScore);
      setLeaderboardStats(stats);
    } catch (err) {
      console.error('Error recording score:', err);
    } finally {
      setIsFinishingGame(false);
    }
  };

  // Handle Option Click or Timeout
  const handleAnswerSelection = (chosenTrackId: number | null, isTimeout: boolean = false) => {
    if (gameState !== 'playing') return;

    // Stop audio immediately
    stopAudio();

    // If timeout, ensure bar visually empties to 0% immediately
    if (isTimeout && timerBarRef.current) {
      timerBarRef.current.style.width = '0%';
    }

    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return;

    const isCorrect = !isTimeout && chosenTrackId === currentQuestion.correctTrack.trackId;

    setSelectedTrackId(chosenTrackId);
    setLastAnswerWasCorrect(isCorrect);
    setGameState('feedback');

    let updatedScore = score;
    if (isCorrect) {
      updatedScore = score + 5;
      const nextStreak = streak + 1;
      setScore(updatedScore);
      setStreak(nextStreak);
      setMaxStreak((prev) => Math.max(prev, nextStreak));
      playCorrectSound();

      // Quick mini confetti on correct streak
      if (nextStreak % 3 === 0) {
        try {
          confetti({
            particleCount: 25,
            spread: 45,
            origin: { y: 0.7 },
            colors: ['#EC4899', '#FBBF24', '#A855F7'],
          });
        } catch {}
      }
    } else {
      setStreak(0);
      playWrongSound();
    }

    // Auto-advance after 1.8s
    feedbackTimeoutRef.current = setTimeout(() => {
      advanceToNextQuestion(updatedScore);
    }, FEEDBACK_DELAY_MS);
  };

  // Sync ref to avoid stale closures in timer callbacks
  useEffect(() => {
    handleAnswerSelectionRef.current = handleAnswerSelection;
  });

  const advanceToNextQuestion = (finalRoundScore: number) => {
    const nextIdx = currentQuestionIndex + 1;
    if (nextIdx < questions.length) {
      setCurrentQuestionIndex(nextIdx);
      setSelectedTrackId(null);
      setLastAnswerWasCorrect(null);
      setGameState('playing');
      startTimerAndAudio(questions[nextIdx].correctTrack.previewUrl);
    } else {
      // Finished all 10 questions!
      setGameState('finished');
      playVictorySound();

      // Big confetti celebration
      try {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#F59E0B', '#EC4899', '#9333EA', '#10B981'],
        });
      } catch {}

      // Automatically store and calculate stats
      processGameCompletion(finalRoundScore);
    }
  };

  // Share score using Web Share API and copy to clipboard
  const handleShareScore = async () => {
    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
    const rating = score >= 45
      ? '👑 Bollywood Shehenshah!'
      : score >= 35
      ? '🌟 Filmi Superfan!'
      : score >= 20
      ? '🎬 Bollywood Enthusiast'
      : '🍿 Chai & Samosa Rookie';

    const totalPts = submissionResult?.newTotalScore ?? score;
    const shareTitle = 'Bollywood Music Quiz';
    const shareText = `🎬 Bollywood Music Quiz\n⚡ Round Score: ${score} pts (${score / 5}/${TOTAL_QUESTIONS} correct) - ${rating}\n🏆 Total Cumulative Score: ${totalPts} pts\n🔥 Max Streak: ${maxStreak}\nCan you beat my score in 10 seconds?\nPlay here: ${shareUrl}`;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareText);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 3500);
      }
    } catch (clipboardErr) {
      console.warn('Clipboard write error:', clipboardErr);
    }

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: `⚡ I scored ${score} pts in this round (${totalPts} total pts) in the Bollywood Music Quiz! Can you beat me?`,
          url: shareUrl,
        });
      } catch (shareErr: unknown) {
        if ((shareErr as { name?: string })?.name !== 'AbortError') {
          console.warn('Web Share API error:', shareErr);
        }
      }
    }
  };

  // Mute toggle
  const toggleMute = () => {
    const next = !soundMuted;
    setSoundMuted(next);
    setSoundEffectsEnabled(!next);
  };

  // Current question data
  const currentQ = questions[currentQuestionIndex];
  // Timer bar percentage: 100% during 5s song playback, then empties from 100% to 0% over 10 seconds
  const timerPercentage = quizPhase === 'listening'
    ? 100
    : Math.max(0, Math.min(100, (timeLeft / GUESS_TIMER_SECONDS) * 100));

  // Determine timer bar color based on remaining time
  const getTimerBarColor = () => {
    if (quizPhase === 'listening') {
      return 'from-purple-500 via-pink-500 to-amber-400 shadow-pink-500/40 animate-pulse';
    }
    if (timeLeft > 5.0) {
      return 'from-emerald-400 via-teal-400 to-amber-400 shadow-emerald-500/50';
    }
    if (timeLeft > 2.5) {
      return 'from-amber-400 via-pink-500 to-rose-500 shadow-amber-500/50';
    }
    return 'from-rose-500 to-red-600 shadow-red-500/60 animate-pulse';
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-6 py-3 sm:py-6">
      {/* Top Bar: Title & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 pb-4 border-b border-purple-800/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-600 to-purple-700 flex items-center justify-center shadow-lg shadow-pink-500/30">
            <Music className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-pink-400 to-purple-300">
              Bollywood Music Quiz
            </h1>
            <p className="text-xs text-purple-300/80">
              5s song clip · 10s timer to guess · 10 options · +5 points per hit
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Sound Mute Button */}
          <button
            onClick={toggleMute}
            className="p-2 rounded-xl bg-purple-950/60 border border-purple-800/50 text-purple-200 hover:text-white hover:border-pink-500/50 transition-colors"
            title={soundMuted ? 'Unmute Sound Effects' : 'Mute Sound Effects'}
            aria-label="Toggle Sound Effects"
          >
            {soundMuted ? <VolumeX className="w-4 h-4 text-pink-400" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
          </button>

          {/* View Leaderboard Button */}
          <button
            onClick={() => setLeaderboardModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-950/60 border border-purple-800/50 text-amber-300 hover:bg-purple-900/60 hover:border-amber-400/50 text-xs font-semibold transition-colors shadow-sm cursor-pointer"
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>Leaderboard</span>
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="relative bg-[#110524]/90 border border-purple-800/60 rounded-3xl p-4 sm:p-7 backdrop-blur-xl shadow-2xl shadow-purple-950/50 overflow-hidden">
        {/* Ambient neon decorative background lights */}
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-pink-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* SCREEN 1: PRE-GAME START PANEL */}
        {gameState === 'intro' && (
          <div className="py-6 sm:py-10 flex flex-col items-center text-center max-w-xl mx-auto relative z-10">
            {/* Header Icon */}
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="relative mb-5"
            >
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-tr from-pink-600 via-purple-600 to-amber-500 flex items-center justify-center shadow-xl shadow-pink-600/30">
                <Headphones className="w-10 h-10 sm:w-12 sm:h-12 text-white drop-shadow-md" />
              </div>
              <div className="absolute -bottom-2 -right-2 bg-amber-400 text-slate-950 font-black text-xs px-2.5 py-0.5 rounded-full shadow-md flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> 5s
              </div>
            </motion.div>

            {/* Prominent Banner & Panel Text */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-pink-500/20 to-amber-500/20 border border-pink-500/40 text-amber-300 text-xs font-black tracking-wide uppercase mb-3 shadow-md shadow-pink-500/10">
              <Sparkles className="w-3.5 h-3.5 text-pink-400" /> Bollywood Music Quiz
            </div>

            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight mb-2 drop-shadow-sm">
              &ldquo;Listen for 5 sec, then guess the song in 10 sec!&rdquo;
            </h2>
            <p className="text-xs sm:text-sm text-purple-300 max-w-md mb-6">
              Each song plays for 5 seconds. Once the song finishes, your 10-second timer begins emptying. Pick the correct song before time runs out!
            </p>

            {/* PRE-GAME INPUT PANEL */}
            <motion.div 
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.35 }}
              className="w-full p-5 sm:p-6 rounded-2xl bg-gradient-to-b from-purple-950/80 to-[#190938]/90 border border-purple-700/60 shadow-xl backdrop-blur-md mb-6 text-left"
            >
              <form onSubmit={handleStartGameWithName} className="space-y-4">
                <div>
                  <label 
                    htmlFor="player-name-input"
                    className="block text-xs font-extrabold text-amber-300 uppercase tracking-wider mb-2 flex items-center justify-between"
                  >
                    <span className="flex items-center gap-1.5">
                      <User className="w-4 h-4 text-pink-400" /> Enter your name:
                    </span>
                    {previousScore !== null && (
                      <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full normal-case font-semibold">
                        Existing Player ({previousScore} pts)
                      </span>
                    )}
                  </label>
                  
                  <div className="relative">
                    <input
                      id="player-name-input"
                      type="text"
                      value={playerName}
                      onChange={(e) => {
                        setPlayerName(e.target.value);
                        if (nameError) setNameError(null);
                      }}
                      placeholder="Enter your name to play..."
                      maxLength={24}
                      className={`w-full px-4 py-3.5 rounded-xl bg-[#0b0319] border text-white text-sm placeholder-purple-400/50 focus:outline-none transition-all ${
                        nameError 
                          ? 'border-rose-500 ring-2 ring-rose-500/40' 
                          : 'border-purple-600/70 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/40'
                      }`}
                    />
                  </div>

                  {nameError && (
                    <p className="text-xs text-rose-400 mt-2 flex items-center gap-1 font-semibold">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {nameError}
                    </p>
                  )}

                  {previousScore !== null && !nameError && (
                    <div className="mt-2.5 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>
                        Welcome back, <strong className="text-white font-bold">{playerName}</strong>! You already have <strong className="text-amber-300 font-bold">{previousScore} pts</strong>. Points from every correct answer (+5 pts) in this game will be added directly to your previous score!
                      </span>
                    </div>
                  )}

                  {previousScore === null && playerName.trim().length >= 2 && !nameError && (
                    <p className="text-[11px] text-purple-300 mt-1.5">
                      New player profile: your points will be saved to the leaderboard, and will continue adding up every time you play again!
                    </p>
                  )}
                </div>

                {/* BOLD COLORFUL BUTTON TO START THE GAME */}
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={isLoadingSongs}
                  className="w-full py-4 px-6 bg-gradient-to-r from-pink-500 via-rose-500 to-amber-400 hover:from-pink-400 hover:to-amber-300 text-slate-950 font-black text-base sm:text-lg rounded-xl shadow-xl shadow-pink-500/30 flex items-center justify-center gap-2.5 transition-all disabled:opacity-50 cursor-pointer uppercase tracking-wider border border-amber-300/40"
                >
                  {isLoadingSongs ? (
                    <>
                      <div className="w-5 h-5 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                      <span>Loading Bollywood Hits...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5 fill-slate-950 text-slate-950" />
                      <span>Start Bollywood Quiz</span>
                    </>
                  )}
                </motion.button>
              </form>
            </motion.div>

            {/* Quick Rules Pills */}
            <div className="grid grid-cols-3 gap-2.5 w-full mb-6 text-center">
              <div className="p-3 rounded-2xl bg-purple-950/40 border border-purple-800/30">
                <div className="text-base font-bold text-amber-400 font-mono">10</div>
                <div className="text-[11px] text-purple-300">Questions</div>
              </div>
              <div className="p-3 rounded-2xl bg-purple-950/40 border border-purple-800/30">
                <div className="text-base font-bold text-pink-400 font-mono">5.0s</div>
                <div className="text-[11px] text-purple-300">Fast Clip</div>
              </div>
              <div className="p-3 rounded-2xl bg-purple-950/40 border border-purple-800/30">
                <div className="text-base font-bold text-emerald-400 font-mono">+5 pts</div>
                <div className="text-[11px] text-purple-300">Per Correct</div>
              </div>
            </div>

            {/* Playlist / Category Filter Tabs */}
            <div className="w-full text-left">
              <label className="block text-xs font-semibold text-purple-300 mb-2 uppercase tracking-wider">
                Select Playlist Edition:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PLAYLIST_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.query)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium border text-left transition-all cursor-pointer ${
                      selectedCategory === cat.query
                        ? 'bg-gradient-to-r from-pink-600/30 to-purple-600/30 border-pink-500 text-amber-300 shadow-md shadow-pink-600/20'
                        : 'bg-purple-950/40 border-purple-800/40 text-purple-300 hover:border-purple-700 hover:text-white'
                    }`}
                  >
                    <div className="truncate font-semibold">{cat.name}</div>
                    <div className="text-[10px] text-purple-400 truncate">{cat.query}</div>
                  </button>
                ))}
              </div>
            </div>

            {loadError && (
              <p className="mt-4 text-xs text-amber-400 bg-amber-950/40 border border-amber-800/50 px-3 py-1.5 rounded-lg">
                {loadError}
              </p>
            )}
          </div>
        )}

        {/* SCREEN 2 & 3: ACTIVE GAMEPLAY & FEEDBACK */}
        {(gameState === 'playing' || gameState === 'feedback') && currentQ && (
          <div className="relative z-10">
            {/* Header with question counter & score (NO / 50!) */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider font-bold text-purple-400">
                  Question
                </span>
                <span className="font-mono text-lg font-black text-amber-300">
                  {currentQuestionIndex + 1}
                  <span className="text-sm text-purple-400 font-normal"> / {TOTAL_QUESTIONS}</span>
                </span>
                {streak > 1 && (
                  <span className="flex items-center gap-1 text-xs font-bold text-pink-400 bg-pink-500/15 border border-pink-500/30 px-2 py-0.5 rounded-full ml-2">
                    <Flame className="w-3.5 h-3.5 text-pink-500 fill-pink-500" />
                    {streak} Streak!
                  </span>
                )}
              </div>

              {/* Player & Score display (NO / 50!) */}
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold truncate max-w-[120px]">
                    {playerName || 'Player'}
                  </div>
                  <div className="font-mono text-xl font-black text-white">
                    {score} <span className="text-xs text-purple-400 font-semibold">pts</span>
                  </div>
                </div>
              </div>
            </div>

            {/* High Visibility Progress Bar (Starts after 5s song, empties over 10s to 0%) */}
            <div className="relative w-full mb-6">
              <div className="flex items-center justify-between text-xs font-mono font-bold mb-1.5">
                {quizPhase === 'listening' ? (
                  <>
                    <span className="flex items-center gap-1.5 text-pink-300">
                      <Radio className="w-3.5 h-3.5 text-pink-400 animate-pulse" />
                      5s Song Clip Playing ({audioTimeLeft.toFixed(1)}s)
                    </span>
                    <span className="text-purple-300 font-semibold text-[11px]">
                      10s Guess Timer starts in {audioTimeLeft.toFixed(1)}s
                    </span>
                  </>
                ) : quizPhase === 'feedback' && selectedTrackId === null ? (
                  <>
                    <span className="flex items-center gap-1 text-rose-400">
                      <XCircle className="w-3.5 h-3.5" />
                      Time Ended
                    </span>
                    <span className="text-xs text-rose-400 font-black">
                      0.0s (Time&apos;s Up!)
                    </span>
                  </>
                ) : (
                  <>
                    <span className="flex items-center gap-1 text-purple-300">
                      <Clock className="w-3.5 h-3.5 text-pink-400" />
                      10s Guess Timer
                    </span>
                    <span className={`text-sm ${timeLeft <= 3.0 ? 'text-red-400 font-black animate-pulse' : 'text-amber-300'}`}>
                      {timeLeft.toFixed(1)}s
                    </span>
                  </>
                )}
              </div>
              <div className="w-full h-3.5 bg-purple-950/80 rounded-full overflow-hidden border border-purple-800/50 p-0.5 shadow-inner">
                <div
                  ref={timerBarRef}
                  className={`h-full rounded-full bg-gradient-to-r shadow-lg transition-colors duration-300 ${getTimerBarColor()}`}
                  style={{ width: `${timerPercentage}%` }}
                />
              </div>
            </div>

            {/* Central Listening / Soundstage Card */}
            <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-purple-950/50 to-purple-900/20 border border-purple-700/40 text-center relative overflow-hidden">
              <div className="flex flex-col items-center justify-center">
                {/* Audio pulse & equalizer icon */}
                <div className="relative mb-3">
                  <motion.div
                    animate={
                      isPlayingAudio && gameState === 'playing'
                        ? {
                            scale: [1, 1.15, 1],
                            boxShadow: [
                              '0 0 0 0px rgba(236, 72, 153, 0.4)',
                              '0 0 0 16px rgba(236, 72, 153, 0)',
                              '0 0 0 0px rgba(236, 72, 153, 0)',
                            ],
                          }
                        : {}
                    }
                    transition={{ repeat: Infinity, duration: 1 }}
                    className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg transition-colors ${
                      isPlayingAudio
                        ? 'bg-gradient-to-tr from-pink-500 to-amber-500 text-white'
                        : 'bg-purple-900/60 text-purple-400'
                    }`}
                  >
                    <Radio className="w-8 h-8" />
                  </motion.div>
                </div>

                <div className="text-center">
                  <h3 className="text-lg font-bold text-white mb-1">
                    {gameState === 'feedback' ? (
                      lastAnswerWasCorrect ? (
                        <span className="text-emerald-400 flex items-center justify-center gap-1.5 font-black">
                          <CheckCircle className="w-5 h-5" /> Correct! +5 Points
                        </span>
                      ) : (
                        <span className="text-rose-400 flex items-center justify-center gap-1.5 font-black">
                          <XCircle className="w-5 h-5" />
                          {selectedTrackId === null ? "Time's Up!" : 'Incorrect!'}
                        </span>
                      )
                    ) : quizPhase === 'listening' ? (
                      'Listen to the Bollywood Hit!'
                    ) : (
                      'Guess the Bollywood Hit!'
                    )}
                  </h3>

                  {gameState === 'feedback' && (
                    <p className="text-xs text-purple-200 mt-1">
                      Correct Answer:{' '}
                      <strong className="text-amber-300 font-bold">
                        {currentQ.correctTrack.trackName}
                      </strong>{' '}
                      by {currentQ.correctTrack.artistName}
                    </p>
                  )}

                  {gameState === 'playing' && quizPhase === 'listening' && (
                    <p className="text-xs text-purple-300 flex items-center justify-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-pink-500 animate-ping" />
                      5-second audio preview playing... (Tap early to guess, or wait for the 10s timer!)
                    </p>
                  )}

                  {gameState === 'playing' && quizPhase === 'guessing' && (
                    <p className="text-xs text-amber-300 flex items-center justify-center gap-1.5 font-semibold">
                      <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                      Audio finished! Pick your song before the 10s timer bar empties!
                    </p>
                  )}

                  {/* Autoplay fallback button if browser blocked sound */}
                  {audioAutoplayBlocked && gameState === 'playing' && (
                    <button
                      onClick={handleManualPlayAudio}
                      className="mt-2 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg shadow flex items-center gap-1.5 mx-auto cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" /> Tap to Unmute / Play Audio
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 10 OPTIONS GRID (Mobile First: 2 columns on mobile, 5 columns on desktop) */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3">
              {currentQ.options.map((option, idx) => {
                const isSelected = selectedTrackId === option.trackId;
                const isTheCorrectTrack = option.trackId === currentQ.correctTrack.trackId;

                let buttonStyle = 'bg-[#180b33] border-purple-800/60 text-purple-100 hover:border-pink-500 hover:bg-purple-900/50 hover:shadow-lg hover:shadow-pink-500/10 cursor-pointer';

                if (gameState === 'feedback') {
                  if (isTheCorrectTrack) {
                    buttonStyle = 'bg-emerald-950/80 border-emerald-500 text-emerald-100 ring-2 ring-emerald-500 shadow-lg shadow-emerald-500/20';
                  } else if (isSelected && !lastAnswerWasCorrect) {
                    buttonStyle = 'bg-rose-950/80 border-rose-500 text-rose-200 ring-2 ring-rose-500 shadow-lg shadow-rose-500/20';
                  } else {
                    buttonStyle = 'bg-[#180b33]/40 border-purple-900/30 text-purple-400/60 opacity-40';
                  }
                }

                return (
                  <motion.button
                    key={`${currentQ.questionNumber}-${option.trackId}`}
                    initial={{ scale: 0.92, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: idx * 0.03, duration: 0.2 }}
                    whileHover={gameState === 'playing' ? { scale: 1.02 } : {}}
                    whileTap={gameState === 'playing' ? { scale: 0.98 } : {}}
                    onClick={() => handleAnswerSelection(option.trackId, false)}
                    disabled={gameState === 'feedback'}
                    className={`relative p-3 rounded-2xl border text-left flex flex-col justify-between transition-all min-h-[90px] sm:min-h-[105px] overflow-hidden ${buttonStyle}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="w-8 h-8 rounded-lg overflow-hidden bg-purple-950 shrink-0 border border-purple-800/50">
                        {option.artworkUrl100 ? (
                          <img
                            src={option.artworkUrl100}
                            alt=""
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-purple-400">
                            <Music className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                      <span className="font-mono text-[10px] text-purple-400 font-bold px-1.5 py-0.5 rounded bg-purple-900/30">
                        #{idx + 1}
                      </span>
                    </div>

                    <div className="w-full">
                      <p className="text-xs sm:text-sm font-bold leading-tight line-clamp-2 text-white">
                        {option.trackName}
                      </p>
                      <p className="text-[10px] sm:text-[11px] text-purple-300/80 truncate mt-0.5">
                        {option.artistName}
                      </p>
                    </div>

                    {gameState === 'feedback' && isTheCorrectTrack && (
                      <div className="absolute top-2 right-2 text-emerald-400 bg-emerald-950 rounded-full p-0.5">
                        <CheckCircle className="w-4 h-4 fill-emerald-500 text-white" />
                      </div>
                    )}
                    {gameState === 'feedback' && isSelected && !lastAnswerWasCorrect && (
                      <div className="absolute top-2 right-2 text-rose-400 bg-rose-950 rounded-full p-0.5">
                        <XCircle className="w-4 h-4 fill-rose-500 text-white" />
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}

        {/* SCREEN 4: GAME FINISHED, LEADERBOARD IN FRONT WITH POSITION HIGHLIGHTED & GAP STATS UNDER IT */}
        {gameState === 'finished' && (
          <div className="py-2 sm:py-4 max-w-2xl mx-auto relative z-10">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="space-y-3.5"
            >
              {/* COMPACT ROUND SUMMARY BANNER (Keeps screen uncluttered so leaderboard is in front!) */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-purple-950/90 via-[#180a30] to-purple-950/90 border border-purple-800/70 shadow-lg flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 flex items-center justify-center shadow-md shadow-pink-600/30 shrink-0">
                    <Trophy className="w-5 h-5 text-slate-950" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider font-extrabold text-pink-400">
                        Round Complete
                      </span>
                      <span className="text-xs text-purple-400 font-semibold">•</span>
                      <span className="text-xs font-bold text-amber-300">
                        {score >= 45
                          ? '👑 Bollywood Shehenshah!'
                          : score >= 35
                          ? '🌟 Filmi Superfan!'
                          : score >= 20
                          ? '🎬 Bollywood Enthusiast'
                          : '🍿 Chai & Samosa Rookie'}
                      </span>
                    </div>
                    <p className="text-xs text-purple-200 mt-0.5">
                      Great job <strong className="text-white">{playerName}</strong>!
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  <div className="px-2.5 py-1 rounded-xl bg-purple-900/60 border border-purple-700/50 text-right">
                    <div className="text-[10px] uppercase text-purple-400 font-bold">Round</div>
                    <div className="font-mono text-sm font-black text-pink-400">
                      +{score} <span className="text-[10px] text-purple-400 font-normal">pts</span>
                    </div>
                  </div>
                  <div className="px-3 py-1 rounded-xl bg-gradient-to-r from-pink-950/60 to-purple-900/60 border border-pink-500/40 text-right shadow-sm">
                    <div className="text-[10px] uppercase text-amber-300 font-bold flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5 text-amber-400" /> Total
                    </div>
                    <div className="font-mono text-sm font-black text-amber-300">
                      {submissionResult?.newTotalScore ?? (previousScore !== null ? previousScore + score : score)}{' '}
                      <span className="text-[10px] text-purple-300 font-normal">pts</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 1. THE LEADERBOARD APPEARS IN FRONT (Position highlighted, no scrolling needed!) */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-[#0e041d] border border-purple-700/60 shadow-2xl text-left">
                <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-purple-800/50">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                      Leaderboard Standings
                    </h3>
                  </div>

                  {leaderboardStats && (
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-pink-500/20 border border-pink-500/40 text-[11px] font-bold text-pink-300">
                        Your Rank: #{leaderboardStats.userRank ?? '?'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Leaderboard entries */}
                {isFinishingGame || !leaderboardStats ? (
                  <div className="py-8 flex flex-col items-center justify-center gap-2 text-purple-400">
                    <RefreshCw className="w-5 h-5 animate-spin text-pink-500" />
                    <span className="text-xs">Updating standings...</span>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {leaderboardStats.entries.slice(0, 10).map((item, index) => {
                      const isCurrentUser =
                        playerName.trim() &&
                        item.username.toLowerCase() === playerName.trim().toLowerCase();

                      const isTop3 = index < 3;
                      const rankStyles = [
                        'bg-amber-500/15 border-amber-500/50 text-amber-300 shadow-sm',
                        'bg-slate-400/10 border-slate-400/40 text-slate-200',
                        'bg-amber-700/15 border-amber-700/40 text-amber-400',
                      ];

                      return (
                        <div
                          key={`${item.username}-${index}-${item.score}`}
                          className={`flex items-center justify-between px-3 py-1.5 sm:py-2 rounded-xl border transition-all ${
                            isCurrentUser
                              ? 'bg-gradient-to-r from-pink-600/35 via-purple-600/40 to-amber-500/35 border-2 border-pink-400 shadow-lg shadow-pink-500/25 ring-2 ring-pink-500/40 font-bold'
                              : isTop3
                              ? rankStyles[index]
                              : 'bg-purple-950/30 border-purple-800/30 text-purple-200'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-6 text-center font-mono font-bold text-xs">
                              {index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                            </span>
                            <div className="min-w-0 flex items-center gap-2">
                              <span
                                className={`text-xs sm:text-sm font-semibold truncate ${
                                  isCurrentUser ? 'text-white font-black' : 'text-slate-200'
                                }`}
                              >
                                {item.username}
                              </span>
                              {isCurrentUser && (
                                <span className="text-[10px] font-black uppercase text-pink-100 bg-pink-500 border border-pink-300 px-1.5 py-0.5 rounded shadow-sm animate-pulse">
                                  YOU
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`font-mono text-xs sm:text-sm font-black ${isCurrentUser ? 'text-amber-300' : 'text-slate-100'}`}>
                              {item.score}
                            </span>
                            <span className="text-[10px] text-purple-400">pts</span>
                            {isTop3 && (
                              <Medal
                                className={`w-3.5 h-3.5 ${
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
                    })}

                    {/* If user is ranked outside top 10, pin their position at the bottom with highlight */}
                    {!leaderboardStats.isInTop10 && leaderboardStats.userRank && (
                      <>
                        <div className="py-0.5 text-center text-[10px] text-purple-400 font-mono tracking-widest">
                          •••
                        </div>
                        <div className="flex items-center justify-between px-3 py-1.5 sm:py-2 rounded-xl border-2 border-pink-400 bg-gradient-to-r from-pink-600/35 via-purple-600/40 to-amber-500/35 shadow-lg shadow-pink-500/25 ring-2 ring-pink-500/40 font-bold">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-6 text-center font-mono font-black text-xs text-amber-300">
                              #{leaderboardStats.userRank}
                            </span>
                            <div className="min-w-0 flex items-center gap-2">
                              <span className="text-xs sm:text-sm font-black text-white truncate">
                                {playerName}
                              </span>
                              <span className="text-[10px] font-black uppercase text-pink-100 bg-pink-500 border border-pink-300 px-1.5 py-0.5 rounded shadow-sm animate-pulse">
                                YOU
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono text-xs sm:text-sm font-black text-amber-300">
                              {leaderboardStats.userTotalScore}
                            </span>
                            <span className="text-[10px] text-purple-400">pts</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* 2. DIRECTLY UNDER THE LEADERBOARD: HOW MUCH REQUIRED TO BE IN TOP 3 OR TOP 10 */}
              {leaderboardStats && (
                <div className="text-left">
                  {/* Case A: Already in Top 10 (Rank 4 to 10) -> How much required to be in Top 3 */}
                  {leaderboardStats.isInTop10 && !leaderboardStats.isInTop3 ? (
                    <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-950/60 via-purple-950/80 to-pink-950/60 border-2 border-amber-400/70 shadow-lg shadow-amber-500/15 flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-400 to-pink-500 text-slate-950 flex items-center justify-center font-black text-xl shrink-0 shadow-md">
                        🎯
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] uppercase font-extrabold text-amber-300 tracking-wider flex items-center gap-1.5">
                          <span>Top 10 Contender (Rank #{leaderboardStats.userRank})</span>
                        </div>
                        <div className="text-sm sm:text-base font-black text-white mt-0.5 leading-snug">
                          You need <span className="text-amber-300 font-extrabold underline decoration-amber-400 decoration-2 underline-offset-2">+{leaderboardStats.scoreNeededForTop3} more pts</span> to be in the Top 3!
                        </div>
                        <p className="text-[11px] text-purple-200 mt-1">
                          3rd place ({leaderboardStats.entries[2]?.username || 'Podium'}) has {leaderboardStats.top3Score} pts. That is just <strong className="text-amber-300 font-bold">{Math.ceil(leaderboardStats.scoreNeededForTop3 / 5)} correct songs</strong> away!
                        </p>
                      </div>
                    </div>
                  ) : !leaderboardStats.isInTop10 ? (
                    /* Case B: NOT in Top 10 (Rank > 10) -> How much required to be in Top 10 */
                    <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-pink-950/60 via-purple-950/80 to-purple-900/60 border-2 border-pink-500/70 shadow-lg shadow-pink-500/15 flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-600 text-white flex items-center justify-center font-black text-xl shrink-0 shadow-md">
                        🎯
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] uppercase font-extrabold text-pink-400 tracking-wider flex items-center gap-1.5">
                          <span>Leaderboard Position: #{leaderboardStats.userRank ?? '?'}</span>
                        </div>
                        <div className="text-sm sm:text-base font-black text-white mt-0.5 leading-snug">
                          You need <span className="text-pink-400 font-extrabold underline decoration-pink-400 decoration-2 underline-offset-2">+{leaderboardStats.scoreNeededForTop10} more pts</span> to be in the Top 10!
                        </div>
                        <p className="text-[11px] text-purple-200 mt-1">
                          10th place ({leaderboardStats.entries[9]?.username || 'Top 10'}) has {leaderboardStats.top10Score} pts. That is just <strong className="text-pink-300 font-bold">{Math.ceil(leaderboardStats.scoreNeededForTop10 / 5)} correct songs</strong> away!
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* Case C: Already in Top 3 Podium */
                    <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-500/25 via-pink-500/20 to-purple-600/25 border-2 border-amber-400 shadow-xl shadow-amber-500/15 flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center font-black text-2xl shrink-0 shadow-md">
                        👑
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] uppercase font-extrabold text-amber-300 tracking-wider">
                          Podium Champion
                        </div>
                        <div className="text-sm sm:text-base font-black text-white mt-0.5 leading-snug">
                          You are <span className="text-amber-300 font-extrabold">Rank #{leaderboardStats.userRank}</span> in the Top 3 Podium!
                        </div>
                        <p className="text-[11px] text-purple-200 mt-1">
                          Bollywood Shehenshah mastery! Play again to defend your spot or claim #1!
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 3. HIGHLIGHTED "START AGAIN" BUTTON RIGHT UNDER THE REQUIREMENT (DESIRE TO PLAY AGAIN) */}
              <div className="pt-1 flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleStartGame}
                  className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-pink-500 via-rose-500 to-amber-400 hover:from-pink-400 hover:to-amber-300 text-slate-950 font-black text-sm sm:text-base rounded-2xl shadow-xl shadow-pink-500/35 flex items-center justify-center gap-2.5 transition-all cursor-pointer ring-2 ring-amber-300/80 uppercase tracking-wider"
                >
                  <RotateCcw className="w-5 h-5 stroke-[2.5]" />
                  <span>Start Again (+Add More Points)</span>
                </motion.button>

                {/* Share Score Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleShareScore}
                  className="w-full sm:w-auto px-5 py-3 bg-purple-950/80 hover:bg-purple-900 border border-purple-700/70 hover:border-pink-500/50 text-purple-200 font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer text-xs sm:text-sm"
                >
                  {shareCopied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
                      <span className="text-emerald-300">Score Copied!</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4 text-pink-400" />
                      <span>Share Score</span>
                    </>
                  )}
                </motion.button>

                {/* Change Player button */}
                <button
                  onClick={() => setGameState('intro')}
                  className="w-full sm:w-auto px-4 py-2.5 text-purple-400 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Change Name / Playlist</span>
                </button>
              </div>

              {shareCopied && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="py-2 px-3 bg-amber-500/15 border border-amber-500/30 rounded-xl text-xs text-amber-200 flex items-center justify-center gap-1.5 text-center"
                >
                  <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Score summary & app link copied to clipboard! Ready to paste into WhatsApp, Discord, or X.</span>
                </motion.div>
              )}
            </motion.div>
          </div>
        )}
      </div>

      {/* Supabase Leaderboard Modal (can be viewed anytime from header) */}
      <LeaderboardModal
        isOpen={leaderboardModalOpen}
        onClose={() => setLeaderboardModalOpen(false)}
        highlightUsername={playerName}
        recentScore={submissionResult?.newTotalScore ?? score}
      />
    </div>
  );
};

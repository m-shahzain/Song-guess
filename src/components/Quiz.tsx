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
  Send, 
  Radio, 
  AlertCircle,
  Headphones,
  Award,
  Share2,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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
import { submitLeaderboardScore, getPlayerCurrentScore } from '../lib/supabase';
import { LeaderboardModal } from './LeaderboardModal';

const QUIZ_ROUND_SECONDS = 5.0;
const FEEDBACK_DELAY_MS = 1500;
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
  
  // Timer state
  const [timeLeft, setTimeLeft] = useState<number>(QUIZ_ROUND_SECONDS);
  
  // Answer selection state (Anti-cheat: correct is only evaluated in memory)
  const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);
  const [lastAnswerWasCorrect, setLastAnswerWasCorrect] = useState<boolean | null>(null);

  // Audio elements & timers
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerAnimationRef = useRef<number | null>(null);
  const audioTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const roundStartTimeRef = useRef<number>(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [audioAutoplayBlocked, setAudioAutoplayBlocked] = useState<boolean>(false);
  const [soundMuted, setSoundMuted] = useState<boolean>(!isSoundEffectsEnabled());

  // Leaderboard submit state with persistent name and cumulative score support
  const [playerName, setPlayerName] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('bollywood_quiz_player_name') || '';
    }
    return '';
  });
  const [previousScore, setPreviousScore] = useState<number | null>(null);
  const [isCheckingPlayer, setIsCheckingPlayer] = useState<boolean>(false);
  const [submissionResult, setSubmissionResult] = useState<{
    newTotalScore: number;
    previousScore: number;
    isExistingUser: boolean;
  } | null>(null);
  const [isSubmittingScore, setIsSubmittingScore] = useState<boolean>(false);
  const [scoreSubmitted, setScoreSubmitted] = useState<boolean>(false);
  const [leaderboardModalOpen, setLeaderboardModalOpen] = useState<boolean>(false);
  const [shareCopied, setShareCopied] = useState<boolean>(false);

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

    const shareTitle = 'Bollywood 5-Second Music Quiz';
    const shareText = `🎬 Bollywood 5-Second Music Quiz\n⚡ I scored ${score}/50 pts (${score / 5}/${TOTAL_QUESTIONS} correct) - ${rating}\n🔥 Max Streak: ${maxStreak}\nCan you beat my score in 5 seconds?\nPlay here: ${shareUrl}`;

    // Always copy score and app link to clipboard
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareText);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 3500);
      }
    } catch (clipboardErr) {
      console.warn('Clipboard write error:', clipboardErr);
    }

    // Invoke Web Share API if supported
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: `⚡ I scored ${score}/50 points in the Bollywood 5-Second Music Quiz! Can you beat me in 5 seconds?`,
          url: shareUrl,
        });
      } catch (shareErr: unknown) {
        if ((shareErr as { name?: string })?.name !== 'AbortError') {
          console.warn('Web Share API error:', shareErr);
        }
      }
    }
  };

  // Check if player name exists whenever name or game state changes
  useEffect(() => {
    let isSubscribed = true;
    const checkName = async () => {
      const clean = playerName.trim();
      if (clean.length >= 2) {
        setIsCheckingPlayer(true);
        const existing = await getPlayerCurrentScore(clean);
        if (isSubscribed) {
          setPreviousScore(existing);
          setIsCheckingPlayer(false);
        }
      } else {
        if (isSubscribed) {
          setPreviousScore(null);
          setIsCheckingPlayer(false);
        }
      }
    };
    const timer = setTimeout(checkName, 250);
    return () => {
      isSubscribed = false;
      clearTimeout(timer);
    };
  }, [playerName, gameState]);

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
    } catch (err) {
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
    if (timerAnimationRef.current) {
      cancelAnimationFrame(timerAnimationRef.current);
      timerAnimationRef.current = null;
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

  // Start the 5-second timer
  const startTimerAndAudio = useCallback((previewUrl: string) => {
    stopAudio();
    setTimeLeft(QUIZ_ROUND_SECONDS);
    setAudioAutoplayBlocked(false);

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

    roundStartTimeRef.current = performance.now();

    // 5-second precise timeout to stop audio and handle timeout
    audioTimeoutRef.current = setTimeout(() => {
      stopAudio();
      // If user hasn't selected an option yet, it's a timeout!
      handleAnswerSelection(null, true);
    }, QUIZ_ROUND_SECONDS * 1000);

    // 60 FPS smooth progress bar update
    const updateProgress = () => {
      const elapsedMs = performance.now() - roundStartTimeRef.current;
      const remainingSeconds = Math.max(0, QUIZ_ROUND_SECONDS - elapsedMs / 1000);
      setTimeLeft(remainingSeconds);

      if (remainingSeconds > 0) {
        timerAnimationRef.current = requestAnimationFrame(updateProgress);
      } else {
        setTimeLeft(0);
      }
    };

    timerAnimationRef.current = requestAnimationFrame(updateProgress);
  }, [stopAudio]);

  // Start Game
  const handleStartGame = () => {
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
      setScoreSubmitted(false);
      setSubmissionResult(null);
      setGameState('playing');

      // Play first round audio
      setTimeout(() => {
        startTimerAndAudio(generatedRounds[0].correctTrack.previewUrl);
      }, 100);
    } catch (err) {
      console.error('Error starting game:', err);
      setLoadError('Failed to prepare quiz rounds. Please refresh and try again.');
    }
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

  // Handle Option Click or Timeout
  const handleAnswerSelection = (chosenTrackId: number | null, isTimeout: boolean = false) => {
    if (gameState !== 'playing') return;

    // Stop audio immediately
    stopAudio();

    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return;

    const isCorrect = !isTimeout && chosenTrackId === currentQuestion.correctTrack.trackId;

    setSelectedTrackId(chosenTrackId);
    setLastAnswerWasCorrect(isCorrect);
    setGameState('feedback');

    if (isCorrect) {
      const nextScore = score + 5;
      const nextStreak = streak + 1;
      setScore(nextScore);
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

    // Auto-advance after 1.5s
    feedbackTimeoutRef.current = setTimeout(() => {
      advanceToNextQuestion();
    }, FEEDBACK_DELAY_MS);
  };

  const advanceToNextQuestion = () => {
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
    }
  };

  // Submit score to Supabase / Leaderboard with cumulative score support
  const handleSubmitScore = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = playerName.trim();
    if (!cleanName || isSubmittingScore || scoreSubmitted) return;

    setIsSubmittingScore(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('bollywood_quiz_player_name', cleanName);
    }

    const result = await submitLeaderboardScore(cleanName, score);
    setIsSubmittingScore(false);
    setScoreSubmitted(true);
    setSubmissionResult(result);
    setPreviousScore(result.newTotalScore);
    setLeaderboardModalOpen(true);
  };

  // Mute toggle
  const toggleMute = () => {
    const next = !soundMuted;
    setSoundMuted(next);
    setSoundEffectsEnabled(!next);
  };

  // Current question data
  const currentQ = questions[currentQuestionIndex];
  const timerPercentage = Math.max(0, Math.min(100, (timeLeft / QUIZ_ROUND_SECONDS) * 100));

  // Determine timer bar color based on remaining time
  const getTimerBarColor = () => {
    if (timeLeft > 3.0) return 'from-amber-400 to-amber-500 shadow-amber-500/50';
    if (timeLeft > 1.5) return 'from-pink-500 to-rose-500 shadow-pink-500/50';
    return 'from-red-500 to-red-600 shadow-red-500/50 animate-pulse';
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
      {/* Top Bar: Playlist Selector & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-purple-800/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-600 to-purple-700 flex items-center justify-center shadow-lg shadow-pink-500/30">
            <Music className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-pink-400 to-purple-300">
              Bollywood 5-Sec Quiz
            </h1>
            <p className="text-xs text-purple-300/80">
              Listen to 5 seconds · 10 options · Guess the hit song
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
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-950/60 border border-purple-800/50 text-amber-300 hover:bg-purple-900/60 hover:border-amber-400/50 text-xs font-semibold transition-colors shadow-sm"
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

        {/* SCREEN 1: INTRO / LOBBY */}
        {gameState === 'intro' && (
          <div className="py-8 sm:py-12 flex flex-col items-center text-center max-w-xl mx-auto relative z-10">
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="relative mb-6"
            >
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-tr from-pink-600 via-purple-600 to-amber-500 flex items-center justify-center shadow-xl shadow-pink-600/30">
                <Headphones className="w-12 h-12 text-white drop-shadow-md" />
              </div>
              <div className="absolute -bottom-2 -right-2 bg-amber-400 text-slate-950 font-black text-xs px-2.5 py-1 rounded-full shadow-md flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> 5s Clip
              </div>
            </motion.div>

            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">
              Are you the Ultimate Bollywood Fan?
            </h2>
            <p className="text-sm text-purple-300 max-w-md mb-8">
              A 5-second iTunes audio preview will play. You have 10 song choices. React lightning-fast before the time runs out!
            </p>

            {/* Playlist / Category Filter Tabs */}
            <div className="w-full mb-8 text-left">
              <label className="block text-xs font-semibold text-purple-300 mb-2 uppercase tracking-wider">
                Select Playlist Edition:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PLAYLIST_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.query)}
                    className={`px-3 py-2.5 rounded-xl text-xs font-medium border text-left transition-all ${
                      selectedCategory === cat.query
                        ? 'bg-gradient-to-r from-pink-600/30 to-purple-600/30 border-pink-500 text-amber-300 shadow-md shadow-pink-600/20'
                        : 'bg-purple-950/40 border-purple-800/40 text-purple-300 hover:border-purple-700 hover:text-white'
                    }`}
                  >
                    <div className="truncate font-semibold">{cat.name}</div>
                    <div className="text-[10px] text-purple-400 truncate">iTunes: {cat.query}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Rules Quick Info */}
            <div className="grid grid-cols-3 gap-3 w-full mb-8 text-center">
              <div className="p-3 rounded-2xl bg-purple-950/40 border border-purple-800/30">
                <div className="text-base font-bold text-amber-400 font-mono">10</div>
                <div className="text-[11px] text-purple-300">Questions</div>
              </div>
              <div className="p-3 rounded-2xl bg-purple-950/40 border border-purple-800/30">
                <div className="text-base font-bold text-pink-400 font-mono">5.0s</div>
                <div className="text-[11px] text-purple-300">Strict Timer</div>
              </div>
              <div className="p-3 rounded-2xl bg-purple-950/40 border border-purple-800/30">
                <div className="text-base font-bold text-emerald-400 font-mono">+5 pts</div>
                <div className="text-[11px] text-purple-300">Per Hit</div>
              </div>
            </div>

            {/* Start Button */}
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleStartGame}
              disabled={isLoadingSongs}
              className="w-full sm:w-auto px-10 py-4 bg-gradient-to-r from-pink-500 via-purple-600 to-amber-500 hover:from-pink-400 hover:to-amber-400 text-white font-extrabold text-lg rounded-2xl shadow-xl shadow-pink-600/30 flex items-center justify-center gap-3 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isLoadingSongs ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Loading Bollywood Hits...</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 fill-white" />
                  <span>Start 5-Second Quiz</span>
                </>
              )}
            </motion.button>

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
            {/* Header with question counter & score */}
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

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-[11px] uppercase tracking-wider text-purple-400 font-semibold">
                    Score
                  </div>
                  <div className="font-mono text-xl font-black text-white">
                    {score} <span className="text-xs text-purple-400">/ 50</span>
                  </div>
                </div>
              </div>
            </div>

            {/* High Visibility Progress Bar (Shrinks from 100% to 0% in 5 seconds) */}
            <div className="relative w-full mb-6">
              <div className="flex items-center justify-between text-xs font-mono font-bold mb-1.5">
                <span className="flex items-center gap-1 text-purple-300">
                  <Clock className="w-3.5 h-3.5 text-pink-400" />
                  Time Remaining
                </span>
                <span className={`text-sm ${timeLeft <= 1.5 ? 'text-red-400 font-black animate-pulse' : 'text-amber-300'}`}>
                  {timeLeft.toFixed(1)}s
                </span>
              </div>
              <div className="w-full h-3 bg-purple-950/80 rounded-full overflow-hidden border border-purple-800/40 p-0.5">
                <div
                  className={`h-full rounded-full bg-gradient-to-r transition-[width] duration-75 ease-linear shadow-lg ${getTimerBarColor()}`}
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
                    ) : (
                      'Identify the Bollywood Hit!'
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

                  {gameState === 'playing' && (
                    <p className="text-xs text-purple-300 flex items-center justify-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-pink-500 animate-ping" />
                      5-second audio clip playing... Tap the correct song below!
                    </p>
                  )}

                  {/* Autoplay fallback button if browser blocked sound */}
                  {audioAutoplayBlocked && gameState === 'playing' && (
                    <button
                      onClick={handleManualPlayAudio}
                      className="mt-2 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg shadow flex items-center gap-1.5 mx-auto"
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
                // Anti-Cheat: during 'playing' state, neither DOM nor classes identify the correct song!
                const isSelected = selectedTrackId === option.trackId;
                const isTheCorrectTrack = option.trackId === currentQ.correctTrack.trackId;

                let buttonStyle = 'bg-[#180b33] border-purple-800/60 text-purple-100 hover:border-pink-500 hover:bg-purple-900/50 hover:shadow-lg hover:shadow-pink-500/10 cursor-pointer';

                if (gameState === 'feedback') {
                  if (isTheCorrectTrack) {
                    // Highlight correct in emerald
                    buttonStyle = 'bg-emerald-950/80 border-emerald-500 text-emerald-100 ring-2 ring-emerald-500 shadow-lg shadow-emerald-500/20';
                  } else if (isSelected && !lastAnswerWasCorrect) {
                    // Highlight clicked wrong in rose
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
                    {/* Song artwork preview badge */}
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

                    {/* Song title & Artist */}
                    <div className="w-full">
                      <p className="text-xs sm:text-sm font-bold leading-tight line-clamp-2 text-white">
                        {option.trackName}
                      </p>
                      <p className="text-[10px] sm:text-[11px] text-purple-300/80 truncate mt-0.5">
                        {option.artistName}
                      </p>
                    </div>

                    {/* Visual check/cross indicator on feedback */}
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

        {/* SCREEN 4: GAME FINISHED & SCOREBOARD */}
        {gameState === 'finished' && (
          <div className="py-6 sm:py-8 max-w-lg mx-auto text-center relative z-10">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, type: 'spring' }}
            >
              <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-3xl bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 flex items-center justify-center shadow-xl shadow-pink-600/30 mb-4">
                <Trophy className="w-10 h-10 sm:w-12 sm:h-12 text-slate-950" />
              </div>

              <span className="text-xs uppercase tracking-widest font-extrabold text-pink-400">
                Quiz Complete
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white mt-1 mb-2">
                {score >= 45
                  ? '👑 Bollywood Shehenshah!'
                  : score >= 35
                  ? '🌟 Filmi Superfan!'
                  : score >= 20
                  ? '🎬 Bollywood Enthusiast'
                  : '🍿 Chai & Samosa Rookie'}
              </h2>
              <p className="text-xs sm:text-sm text-purple-300 mb-6">
                You answered {score / 5} of {TOTAL_QUESTIONS} Bollywood songs correctly in 5 seconds!
              </p>

              {/* Total Score Display */}
              <div className="p-6 rounded-2xl bg-purple-950/40 border border-purple-800/40 mb-6 text-center shadow-inner">
                <div className="text-xs text-purple-400 uppercase font-semibold mb-1">
                  Final Score
                </div>
                <div className="font-mono text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-pink-400 to-amber-200">
                  {score}
                  <span className="text-xl text-purple-400 font-normal"> / 50</span>
                </div>
                <div className="mt-3 flex items-center justify-center gap-4 text-xs text-purple-300">
                  <span>
                    Highest Streak: <strong className="text-pink-400">{maxStreak}</strong>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Accuracy: <strong className="text-amber-400">{Math.round((score / 50) * 100)}%</strong>
                  </span>
                </div>
              </div>

              {/* Leaderboard Submission Form */}
              {score > 0 && !scoreSubmitted && (
                <div className="p-5 rounded-2xl bg-gradient-to-br from-pink-950/40 via-purple-950/60 to-purple-900/30 border border-pink-500/30 mb-6 text-left shadow-lg">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-400" /> Save Score to Leaderboard
                    </h3>
                    {previousScore !== null && (
                      <span className="text-[11px] font-mono text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                        Existing: {previousScore} pts
                      </span>
                    )}
                  </div>
                  
                  <p className="text-xs text-purple-300 mb-2.5">
                    {previousScore !== null ? (
                      <span>
                        Welcome back, <strong className="text-white">{playerName}</strong>! Playing again will add this round's{' '}
                        <strong className="text-pink-400">+{score} pts</strong> to your previous{' '}
                        <strong className="text-amber-400">{previousScore} pts</strong> (New Total:{' '}
                        <strong className="text-emerald-400 font-bold">{previousScore + score} pts</strong>).
                      </span>
                    ) : (
                      <span>Enter your name. When you play again, future scores will be added to your total!</span>
                    )}
                  </p>

                  <form onSubmit={handleSubmitScore} className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      placeholder="Enter your name / username"
                      maxLength={20}
                      required
                      className="flex-1 px-3.5 py-2.5 rounded-xl bg-purple-950/80 border border-purple-700/60 text-white text-sm placeholder-purple-400/50 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
                    />
                    <button
                      type="submit"
                      disabled={isSubmittingScore || !playerName.trim()}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-amber-500 hover:from-pink-500 hover:to-amber-400 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-pink-600/30 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                    >
                      {isSubmittingScore ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>
                            {previousScore !== null
                              ? `Add +${score} to Total (${previousScore + score} pts)`
                              : `Save ${score} pts to Leaderboard`}
                          </span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}

              {scoreSubmitted && (
                <div className="p-4 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-xs text-emerald-200 mb-6 text-center space-y-1 shadow-lg shadow-emerald-950/40">
                  <div className="flex items-center justify-center gap-2 font-bold text-sm text-emerald-400">
                    <CheckCircle className="w-4 h-4" />
                    Score successfully updated on the leaderboard!
                  </div>
                  {submissionResult?.isExistingUser ? (
                    <p className="text-purple-200 text-xs">
                      Added <strong className="text-pink-300">+{score} pts</strong> to {playerName}&apos;s previous score ({submissionResult.previousScore} pts).
                      {' '}New cumulative total: <strong className="text-amber-300 font-bold">{submissionResult.newTotalScore} pts</strong>!
                    </p>
                  ) : (
                    <p className="text-purple-200 text-xs">
                      Welcome <strong className="text-white">{playerName}</strong>! Your score of <strong className="text-amber-300 font-bold">{submissionResult?.newTotalScore || score} pts</strong> is recorded. Play again anytime to add more points to your score!
                    </p>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3">
                {/* Share Score Button */}
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleShareScore}
                  className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-amber-400 via-pink-500 to-amber-400 hover:from-amber-300 hover:to-pink-400 text-slate-950 font-black rounded-xl shadow-lg shadow-pink-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  title="Share score and copy challenge link"
                >
                  {shareCopied ? (
                    <>
                      <Check className="w-4 h-4 text-slate-950 stroke-[3]" />
                      <span>Score Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4 text-slate-950" />
                      <span>Share Score</span>
                    </>
                  )}
                </motion.button>

                <button
                  onClick={handleStartGame}
                  className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-bold rounded-xl shadow-lg shadow-pink-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  Play Again
                </button>

                <button
                  onClick={() => setLeaderboardModalOpen(true)}
                  className="w-full sm:w-auto px-6 py-3 bg-purple-950/70 hover:bg-purple-900 border border-purple-700/60 text-amber-300 hover:border-amber-400/50 font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Trophy className="w-4 h-4 text-amber-400" />
                  View Top 10
                </button>

                <button
                  onClick={() => setGameState('intro')}
                  className="w-full sm:w-auto px-4 py-3 text-purple-300 hover:text-white text-xs font-medium transition-colors"
                >
                  Switch Playlist
                </button>
              </div>

              {shareCopied && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 py-2 px-3 bg-amber-500/15 border border-amber-500/30 rounded-xl text-xs text-amber-200 flex items-center justify-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5 text-amber-400" />
                  <span>Score summary & app link copied to clipboard! Ready to paste into WhatsApp, Discord, or X.</span>
                </motion.div>
              )}
            </motion.div>
          </div>
        )}
      </div>

      {/* Supabase Leaderboard Modal */}
      <LeaderboardModal
        isOpen={leaderboardModalOpen}
        onClose={() => setLeaderboardModalOpen(false)}
        highlightUsername={playerName}
        recentScore={score}
      />
    </div>
  );
};

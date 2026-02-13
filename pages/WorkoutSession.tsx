import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, SkipForward, SkipBack, Pause, Play, Edit2 } from 'lucide-react';
import { Exercise, WorkoutPhase } from '../types';
import CircularTimer from '../components/CircularTimer';
import { tts } from '../utils/tts';
import { getOrGenerateCore, getOrGenerateExerciseAnnounce, playBlob, playBlobFit } from '../utils/guidance';
import { Button } from '../components/Button';

interface WorkoutSessionProps {
  exercises: Exercise[];
}

const WorkoutSession: React.FC<WorkoutSessionProps> = ({ exercises }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { initialIndex?: number } | null;
  
  const [exerciseIndex, setExerciseIndex] = useState(state?.initialIndex || 0);
  const [phase, setPhase] = useState<WorkoutPhase>(WorkoutPhase.ANNOUNCE);
  const [timeLeftMs, setTimeLeftMs] = useState(0);
  const [totalTimeMs, setTotalTimeMs] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const frameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const lastSecondBoundary = useRef<number>(-1);
  const lastRepBoundary = useRef<number>(-1);
  const lastSpokenPhaseRef = useRef<WorkoutPhase | null>(null);
  const lastSpokenSecondRef = useRef<number | null>(null);
  const suppressCountdownUntilMsRef = useRef<number>(0);
  const pickerRef = useRef<HTMLDivElement>(null);

  const currentExercise = exercises[exerciseIndex];

  const setupPhaseTimer = useCallback((p: WorkoutPhase) => {
    if (!currentExercise) return;
    let duration = 0;
    if (p === WorkoutPhase.ANNOUNCE || p === WorkoutPhase.PREP) duration = currentExercise.prepTime;
    else if (p === WorkoutPhase.WORK) duration = currentExercise.reps * currentExercise.repDuration;
    else if (p === WorkoutPhase.COOL) duration = currentExercise.coolingTime;

    const durationMs = duration * 1000;
    setTotalTimeMs(durationMs);
    setTimeLeftMs(durationMs);
    lastTimeRef.current = Date.now();
    
    // Initialize boundaries
    lastSecondBoundary.current = Math.ceil(durationMs / 1000);
    lastRepBoundary.current = -1;
    lastSpokenPhaseRef.current = p;
    lastSpokenSecondRef.current = null;
    suppressCountdownUntilMsRef.current = 0;
  }, [currentExercise]);

  const startPhase = useCallback((newPhase: WorkoutPhase) => {
    setPhase(newPhase);
    setupPhaseTimer(newPhase);
    if (newPhase === WorkoutPhase.WORK) {
        (async () => {
            try { await playBlobFit(await getOrGenerateCore(exercises, `n:${currentExercise.reps}`), Math.max(0.6, currentExercise.repDuration * 0.9)); } catch { tts.speak(currentExercise.reps.toString(), true); }
          })();
        lastRepBoundary.current = 0; // First rep (total count) announced
    } else if (newPhase === WorkoutPhase.COOL) {
          (async () => {
            try { await playBlob(await getOrGenerateCore(exercises, `rest`)); } catch { tts.speak("Rest", true); }
          })();
}
  }, [currentExercise, setupPhaseTimer]);

  useEffect(() => {
    if (!exercises.length || !currentExercise) return;
    tts.cancel();
    setPhase(WorkoutPhase.ANNOUNCE);
    setIsPaused(false);
    
    const initialDuration = currentExercise.prepTime * 1000;
    setTimeLeftMs(initialDuration);
    setTotalTimeMs(initialDuration);
    
    if (pickerRef.current) {
        const activeItem = pickerRef.current.children[exerciseIndex + 1] as HTMLElement;
        if (activeItem) {
            activeItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
  }, [exerciseIndex, exercises.length, currentExercise]);

  useEffect(() => {
    if (phase === WorkoutPhase.ANNOUNCE && currentExercise && !isPaused) {
      let active = true;
      const timer = setTimeout(async () => {
        // Announce exercise name FIRST (as requested), then begin PREP countdown.
        try {
          const blob = await getOrGenerateExerciseAnnounce(exercises, currentExercise);
          await playBlob(blob);
        } catch {
          try { await tts.speak(currentExercise.name, true); } catch {}
        }

        if (active) startPhase(WorkoutPhase.PREP);
      }, 120);

      return () => {
        active = false;
        clearTimeout(timer);
      };
    }
  }, [phase, currentExercise, isPaused, startPhase, exercises]);

  
  const pickMotToken = (seed: number) => `mot_${((seed % 10) + 1)}`;
useEffect(() => {
    // Prevent redirect if we are just loading state or have valid exercises
    if (!exercises.length) { 
        // Only redirect if exercises are truly empty after initial load check logic (handled by parent usually)
        // For now, if passed empty exercises, we redirect.
        navigate('/'); 
        return; 
    }
    tts.warmup();
    return () => { 
        cancelAnimationFrame(frameRef.current); 
        tts.cancel(); 
    };
  }, [exercises.length, navigate]);

  useEffect(() => {
    if (isPaused || phase === WorkoutPhase.FINISHED || phase === WorkoutPhase.ANNOUNCE) return;
    
    const loop = () => {
      const now = Date.now();
      const delta = now - lastTimeRef.current;
      lastTimeRef.current = now;
      
      setTimeLeftMs((prev) => {
        const next = Math.max(0, prev - delta);
        
        // Handle PREP/COOL voice countdown (every second)
        if (phase === WorkoutPhase.PREP || phase === WorkoutPhase.COOL) {
          const prevSec = Math.ceil(prev / 1000);
          const currSec = Math.ceil(next / 1000);

          if (prevSec > currSec) {
            // Never speak 0
            if (currSec <= 0) {
              // no-op
            } else {
              const initialSec = Math.ceil(totalTimeMs / 1000);

              // If we're in a motivation window, skip non-critical numbers.
              const suppressed = Date.now() < suppressCountdownUntilMsRef.current;
              const critical = currSec <= 3; // keep the last few seconds always spoken

              if (phase === WorkoutPhase.PREP && currentExercise.prepTime > 2 && currSec === initialSec) {
                // "Get ready" replaces the first number (after exercise name).
                (async () => {
                  try { await playBlobFit(await getOrGenerateCore(exercises, 'get_ready'), 1.2); } catch { /* ignore */ }
                })();
              } else if (phase === WorkoutPhase.PREP && currSec === 1) {
                // Go! instead of "1"
                (async () => {
                  try { await playBlobFit(await getOrGenerateCore(exercises, 'go'), 0.7); } catch { tts.speak('Go!', true); }
                })();
              } else if ((phase === WorkoutPhase.PREP && currentExercise.prepTime >= 8 && currSec === 8) || (phase === WorkoutPhase.COOL && currentExercise.coolingTime >= 10 && currSec === 10)) {
                // Play a longer motivation line and skip a few numbers so it doesn't feel rushed.
                suppressCountdownUntilMsRef.current = Date.now() + 2400;
                const tok = pickMotToken(exerciseIndex + currSec);
                (async () => {
                  try { await playBlobFit(await getOrGenerateCore(exercises, tok), 2.2); } catch { /* ignore */ }
                })();
              } else {
                if (!suppressed || critical) {
                  (async () => {
                    try { await playBlobFit(await getOrGenerateCore(exercises, `n:${currSec}`), 0.95); }
                    catch { tts.speak(currSec.toString(), true); }
                  })();
                }
              }
            }
          }
        }

        // Handle WORK voice reps
        if (phase === WorkoutPhase.WORK) {
            const elapsedPrev = totalTimeMs - prev;
            const elapsedNext = totalTimeMs - next;
            const repDurationMs = currentExercise.repDuration * 1000;
            
            if (repDurationMs > 0) {
                const prevRepIdx = Math.floor(elapsedPrev / repDurationMs);
                const currRepIdx = Math.floor(elapsedNext / repDurationMs);
                
                if (currRepIdx > prevRepIdx) {
                    const repsRemaining = currentExercise.reps - currRepIdx;
                    if (repsRemaining > 0) {
                        (async () => { try { await playBlobFit(await getOrGenerateCore(exercises, `n:${repsRemaining}`), Math.max(0.6, currentExercise.repDuration * 0.9)); } catch { tts.speak(repsRemaining.toString(), true); } })();
                    }
                }
            }
        }
        
        if (next <= 0) { 
            setTimeout(() => handlePhaseComplete(), 0); 
            return 0; 
        }
        return next;
      });
      frameRef.current = requestAnimationFrame(loop);
    };
    
    lastTimeRef.current = Date.now();
    frameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameRef.current);
  }, [phase, isPaused, totalTimeMs, currentExercise]);

  const handlePhaseComplete = () => {
    if (phase === WorkoutPhase.PREP) startPhase(WorkoutPhase.WORK);
    else if (phase === WorkoutPhase.WORK) {
      if (currentExercise.coolingTime > 0) startPhase(WorkoutPhase.COOL);
      else handleNextExercise();
    } else if (phase === WorkoutPhase.COOL) handleNextExercise();
  };

  const handleNextExercise = () => {
    if (exerciseIndex < exercises.length - 1) {
        setExerciseIndex(prev => prev + 1);
    } else { 
        setPhase(WorkoutPhase.FINISHED); 
        (async () => { try { await playBlob(await getOrGenerateCore(exercises, `workout_complete`)); } catch { tts.speak("Workout complete!"); } })(); 
    }
  };
  
  const handlePreviousExercise = () => {
    if (exerciseIndex > 0) {
        setExerciseIndex(prev => prev - 1);
    } else {
        setPhase(WorkoutPhase.ANNOUNCE);
        setIsPaused(false);
    }
  };

  const handleTogglePause = () => {
    tts.warmup();
    setIsPaused(!isPaused);
  };

  if (phase === WorkoutPhase.FINISHED) {
    return (
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center p-6 bg-dark text-white">
        <h1 className="text-4xl font-bold mb-8 text-primary">Done! 🎉</h1>
        <Button onClick={() => navigate('/')} variant="primary" size="lg" fullWidth>Finish Session</Button>
      </div>
    );
  }

  const progress = totalTimeMs > 0 ? timeLeftMs / totalTimeMs : 0;

  // Display logic:
  // - WORK: show reps remaining (matches spoken reps)
  // - PREP/COOL: show seconds remaining
  const secondsLeft = Math.ceil(timeLeftMs / 1000);

  let repsLeft: number | null = null;
  if (phase === WorkoutPhase.WORK) {
    const repDurationMs = currentExercise.repDuration * 1000;
    if (repDurationMs > 0) {
      const elapsedMs = totalTimeMs - timeLeftMs;
      const repsCompleted = Math.floor(elapsedMs / repDurationMs);
      repsLeft = Math.max(0, currentExercise.reps - repsCompleted);
    } else {
      repsLeft = currentExercise.reps;
    }
  }

  const mainText = (phase === WorkoutPhase.WORK && repsLeft !== null)
    ? repsLeft.toString()
    : secondsLeft.toString();

  const subText = (phase === WorkoutPhase.WORK)
    ? 'REPS LEFT'
    : (phase === WorkoutPhase.COOL ? 'RESTING' : 'SECONDS');

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-dark text-white overflow-hidden relative font-sans">
      <header className="flex justify-between items-center px-6 pt-6 pb-2 z-10 shrink-0">
         <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Workout Session</span>
            <span className="text-lg font-bold">Ex {exerciseIndex + 1} <span className="text-slate-500 font-normal">/ {exercises.length}</span></span>
         </div>
         <div className="flex items-center gap-2">
            <button 
                onClick={() => navigate(`/edit/${currentExercise.id}`, { state: { returnPath: '/workout', returnIndex: exerciseIndex } })} 
                className="w-10 h-10 flex items-center justify-center rounded-full bg-surface text-slate-400 hover:text-primary transition-colors border border-white/5"
            >
                <Edit2 size={18} />
            </button>
            <button onClick={() => navigate('/')} className="w-10 h-10 flex items-center justify-center rounded-full bg-surface text-slate-400 hover:text-red-400 transition-colors border border-white/5"><X size={20} /></button>
         </div>
      </header>

      <div className="flex-1 flex flex-col items-center pt-4 px-6 min-h-0">
         <div className="px-5 py-2 rounded-full border border-primary/20 bg-primary/10 mb-4 text-xs font-bold text-primary uppercase tracking-widest min-w-[100px] text-center">
            {phase}
         </div>

         <div className="relative mb-6">
             <CircularTimer progress={progress} size={Math.min(window.innerWidth * 0.7, window.innerHeight * 0.3, 260)} strokeWidth={20} color="#fbbf24" trackColor="#1e293b">
                <div className="flex flex-col items-center">
                    <span className="text-7xl font-bold tabular-nums text-white leading-none">{mainText}</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">{subText}</span>
                </div>
            </CircularTimer>
         </div>

         <div className="text-center px-4 mb-6"><h2 className="text-2xl font-bold truncate max-w-xs">{currentExercise.name}</h2></div>

         <div className="w-full max-w-sm flex-1 min-h-0 mb-6 overflow-hidden">
            <div className="bg-surface rounded-3xl h-full flex flex-col overflow-hidden border border-white/5 relative">
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-16 bg-white/5 border-y border-white/5 pointer-events-none z-0"></div>
                
                <div ref={pickerRef} className="flex-1 overflow-y-auto px-4 snap-y snap-mandatory scrollbar-hide relative z-10">
                    <div className="h-[40%] shrink-0 pointer-events-none"></div>
                    {exercises.map((ex, idx) => (
                        <button 
                            key={ex.id+idx} 
                            onClick={() => { tts.warmup(); setExerciseIndex(idx); }}
                            className={`w-full snap-center flex items-center gap-4 p-4 my-1 rounded-2xl transition-all border duration-300
                                ${idx === exerciseIndex 
                                    ? 'bg-primary/20 border-primary/40 shadow-[0_0_20px_rgba(251,191,36,0.1)] scale-100 opacity-100' 
                                    : 'bg-transparent border-transparent opacity-30 scale-90'}`}
                        >
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors
                                ${idx === exerciseIndex ? 'bg-primary text-slate-900' : 'bg-slate-800 text-slate-500'}`}>
                                {idx === exerciseIndex ? <Play size={18} fill="currentColor" /> : (idx + 1)}
                            </div>
                            <div className="text-left min-w-0 flex-1">
                                <h4 className={`text-sm font-bold truncate transition-colors ${idx === exerciseIndex ? 'text-white' : 'text-slate-400'}`}>
                                    {ex.name}
                                </h4>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">
                                    {ex.reps} reps • {ex.repDuration}s
                                </p>
                            </div>
                        </button>
                    ))}
                    <div className="h-[40%] shrink-0 pointer-events-none"></div>
                </div>
            </div>
         </div>
      </div>

      <div className="px-8 pb-10 flex justify-center items-center gap-8 shrink-0">
          <Button variant="control" onClick={handlePreviousExercise}><SkipBack size={24} fill="currentColor" /></Button>
          <Button variant="primary" size="xl" className="rounded-full shadow-[0_0_50px_-10px_rgba(251,191,36,0.5)]" onClick={handleTogglePause}>
              {isPaused ? <Play size={36} fill="#0f172a" className="ml-1" /> : <Pause size={36} fill="#0f172a" />}
          </Button>
          <Button variant="control" onClick={handleNextExercise}><SkipForward size={24} fill="currentColor" /></Button>
      </div>
    </div>
  );
};

export default WorkoutSession;
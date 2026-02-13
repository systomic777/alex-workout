import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Play, Plus, Settings, Edit2, Trash2, GripVertical, Check, ListOrdered, Clock, Repeat, Timer } from 'lucide-react';
import { Exercise } from '../types';
import { Button } from '../components/Button';
import { tts } from '../utils/tts';

interface HomeProps {
  exercises: Exercise[];
  onDelete: (id: string) => void;
  onReorder: (exercises: Exercise[]) => void;
}

const Home: React.FC<HomeProps> = ({ exercises, onDelete, onReorder }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isReordering, setIsReordering] = useState(false);
  
  // Local state for smooth DnD
  const [localItems, setLocalItems] = useState<Exercise[]>(exercises);
  const dragItem = useRef<number | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Sync local items when parent exercises change (but not mid-drag)
  useEffect(() => {
    if (draggedIndex === null) {
      setLocalItems(exercises);
    }
  }, [exercises, draggedIndex]);

  // Handle auto-scroll to focused exercise if returning from edit
  useEffect(() => {
    const state = location.state as { focusId?: string } | null;
    const focusId = state?.focusId;
    let isMounted = true;

    if (focusId) {
        let attempts = 0;
        const maxAttempts = 20; // Try for up to 2 seconds
        
        const scroll = () => {
            if (!isMounted) return;
            
            const element = document.getElementById(`exercise-${focusId}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Temporary highlight
                element.classList.add('ring-2', 'ring-primary', 'bg-surface-light');
                setTimeout(() => {
                    if (isMounted && element) {
                        element.classList.remove('ring-2', 'ring-primary', 'bg-surface-light');
                    }
                }, 1500);

                // Clean up state so we don't re-scroll on other updates
                navigate(location.pathname, { replace: true, state: {} });
            } else if (attempts < maxAttempts) {
                attempts++;
                setTimeout(scroll, 100);
            }
        };

        // Start polling
        setTimeout(scroll, 100);
    }

    return () => { isMounted = false; };
  }, [location.state?.focusId, navigate, location.pathname]);

  // Desktop Drag Handlers
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, position: number) => {
    dragItem.current = position;
    setDraggedIndex(position);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, position: number) => {
    if (dragItem.current === null || dragItem.current === position) return;
    performSwap(dragItem.current, position);
  };

  const handleDragEnd = () => {
    commitChanges();
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  // Mobile Touch Handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>, position: number) => {
    if (!isReordering) return;
    dragItem.current = position;
    setDraggedIndex(position);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isReordering || dragItem.current === null) return;
    if (e.cancelable) e.preventDefault();

    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    const itemContainer = element?.closest('[data-index]');
    
    if (itemContainer) {
      const targetIndex = parseInt(itemContainer.getAttribute('data-index') || '-1', 10);
      if (targetIndex !== -1 && targetIndex !== dragItem.current) {
        performSwap(dragItem.current, targetIndex);
      }
    }
  };

  const handleTouchEnd = () => {
    if (!isReordering) return;
    commitChanges();
  };

  const performSwap = (from: number, to: number) => {
    const newList = [...localItems];
    const item = newList[from];
    newList.splice(from, 1);
    newList.splice(to, 0, item);
    
    dragItem.current = to;
    setDraggedIndex(to);
    setLocalItems(newList);
  };

  const commitChanges = () => {
    onReorder(localItems);
    dragItem.current = null;
    setDraggedIndex(null);
  };

  return (
    <div className="flex flex-col h-[100dvh] max-w-md mx-auto bg-dark overflow-hidden font-sans">
      {/* Sticky Header */}
      <div className="bg-dark/80 backdrop-blur-xl border-b border-white/5 shrink-0 z-20">
        <header className="flex justify-between items-center px-5 py-5">
          <div className="flex flex-col">
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_rgba(251,191,36,0.6)]"></span>
              Alex Workout
            </h1>
          </div>
          <div className="flex gap-2">
             <Button
               variant={isReordering ? 'primary' : 'ghost'}
               onClick={() => setIsReordering(!isReordering)}
               size="sm"
               className={isReordering ? "!p-2" : "text-slate-400"}
            >
                {isReordering ? <Check size={18} /> : <ListOrdered size={20} />}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/data')} className="text-slate-400">
              <Settings size={20} />
            </Button>
          </div>
        </header>

        <div className="px-5 pb-4 flex gap-3">
          <Button 
            variant="primary" 
            fullWidth 
            onClick={() => {
              // On iOS, a "real" spoken phrase initiated from the tap is the most reliable way
              // to unlock non-native audio. Warmup + short kickoff phrase, then navigate.
              try { tts.warmup(); } catch {}
              try { tts.speak("Starting workout", true); } catch {}
              setTimeout(() => navigate('/workout'), 250);
            }}
            disabled={exercises.length === 0 || isReordering}
            className="flex-1 text-slate-900"
          >
            <Play size={18} fill="currentColor" /> Start Workout
          </Button>
          <Button 
            variant="secondary" 
            onClick={() => navigate('/edit/new')}
            disabled={isReordering}
          >
            <Plus size={18} /> Add
          </Button>
        </div>
      </div>

      {/* Exercise List */}
      <div className="flex-1 p-5 space-y-3 overflow-y-auto min-h-0 scrollbar-hide">
        {localItems.length === 0 ? (
          <div className="text-center py-20 px-6 bg-surface/50 rounded-2xl border border-white/5 border-dashed">
            <p className="text-slate-400 mb-4 text-sm">Your workout list is empty.</p>
            <Button variant="secondary" size="sm" onClick={() => navigate('/edit/new')}>
              Add Exercise
            </Button>
          </div>
        ) : (
          localItems.map((ex, index) => (
            <div 
              id={`exercise-${ex.id}`}
              key={ex.id}
              data-index={index}
              draggable={isReordering}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnter={(e) => handleDragEnter(e, index)}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onTouchStart={(e) => handleTouchStart(e, index)}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{ 
                touchAction: isReordering ? 'none' : 'auto',
                WebkitTouchCallout: isReordering ? 'none' : 'default',
                WebkitUserSelect: isReordering ? 'none' : 'auto',
                userSelect: isReordering ? 'none' : 'auto'
              }}
              className={`group bg-surface hover:bg-surface-light rounded-xl p-3 border transition-all duration-300 flex justify-between items-center
                ${isReordering ? 'cursor-move select-none' : ''}
                ${draggedIndex === index ? 'opacity-30 scale-95 border-primary/50 bg-primary/5' : 'border-white/5 shadow-sm'}
              `}
            >
              <div className="flex items-center gap-4 overflow-hidden pointer-events-none">
                {isReordering ? (
                   <div className="text-slate-500 px-1">
                     <GripVertical size={18} />
                   </div>
                ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-xs font-bold text-primary border border-white/5 shrink-0">
                        {index + 1}
                    </div>
                )}
                
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-slate-100 truncate pr-2">{ex.name}</h3>
                  <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-1 font-bold uppercase tracking-wider">
                    <span className="flex items-center gap-1"><Repeat size={10} /> {ex.reps}</span>
                    <span className="flex items-center gap-1"><Timer size={10} /> {ex.repDuration}s</span>
                    <span className="flex items-center gap-1"><Clock size={10} /> {ex.prepTime}s</span>
                  </div>
                </div>
              </div>
              
              {!isReordering && (
                <div className="flex gap-1">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      try { tts.warmup(); } catch {}
                      try { tts.speak(`Starting ${ex.name}`, true); } catch {}
                      setTimeout(() => navigate('/workout', { state: { initialIndex: index } }), 250);
                    }}
                    className="p-2 text-slate-500 hover:text-emerald-400 transition-colors"
                    title="Start from here"
                  >
                    <Play size={16} fill="currentColor" />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); navigate(`/edit/${ex.id}`); }}
                    className="p-2 text-slate-500 hover:text-primary transition-colors"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(ex.id); }}
                    className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
      
      <div className="text-center py-4 text-[10px] font-bold text-slate-600 shrink-0 border-t border-white/5 uppercase tracking-widest">
        {localItems.length} Exercises • {Math.ceil(localItems.reduce((acc, curr) => acc + curr.prepTime + (curr.reps * curr.repDuration) + curr.coolingTime, 0) / 60)} min
      </div>
    </div>
  );
};

export default Home;
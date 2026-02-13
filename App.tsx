import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import ExerciseEditor from './pages/ExerciseEditor';
import DataManagement from './pages/DataManagement';
import WorkoutSession from './pages/WorkoutSession';
import { Exercise } from './types';
import { importFromCSV } from './utils/csv';

const DEFAULT_CSV_DATA = `id,name,reps,repDuration,prepTime,coolingTime,BodyPart,Easy or Hard
1,Neck rotation left,10,1.0,5,0,neck,easy
2,Neck rotation right,10,1.0,1,0,neck,easy
3,Cat-cow,4,4.0,3,5,torso,easy
4,Pushups,40,1.0,5,0,hands,hard
5,Breathing break,15,1.0,0,0,rest,rest
6,Sumo stance,20,1.0,3,0,legs,easy
7,Happy Jump up,20,1.0,3,0,legs,hard
8,One Legged standing stretch Right,7,1.0,3,0,rest,rest
9,One Legged standing stretch Left,7,1.0,2,0,rest,rest
10,Black push-up,13,1.4,7,0,hands,hard
11,Breathing break,15,1.0,0,0,rest,rest
12,Worrier 3 left,20,1.0,3,0,legs,easy
13,Worrier 3 right,20,1.0,3,0,legs,easy
14,Sit-ups,20,1.2,4,0,legs,hard
15,One Legged standing stretch left,7,1.0,2,0,rest,rest
16,One Legged standing stretch right,7,1.0,2,0,rest,rest
17,Biceps,20,1.0,15,15,hands,hard
18,Breathing break,15,1.0,0,0,rest,rest
19,Staircase,16,1.3,20,0,legs,easy
20,Toes Situps,20,1.4,5,0,legs,hard
21,One Legged standing stretch left,10,1.0,3,0,rest,rest
22,One Legged standing stretch right,10,1.0,3,0,rest,rest
23,Superman,20,1.0,4,0,back,hard
24,Breathing break,15,1.0,0,0,rest,rest
25,Short bridge,40,1.0,5,0,legs,easy
26,Long bridge,30,1.0,2,0,legs,easy
27,Sumo situps,20,1.2,3,0,legs,hard
28,One Legged standing stretch left,7,1.0,2,0,rest,rest
29,One Legged standing stretch right,7,1.0,2,0,rest,rest
30,Shoulder dumbbell sides,20,2.7,7,0,hands,hard
31,Shoulder dumbbell forward,10,3.0,7,0,hands,hard
32,Breathing break,15,1.0,0,0,rest,rest
33,Ankle raise,30,1.0,5,0,legs,easy
34,Chairless sit-up,45,1.0,15,0,legs,hard
35,One Legged standing stretch left,7,1.0,2,0,rest,rest
36,One Legged standing stretch right,7,1.0,2,0,rest,rest
37,Neck pushups forward,40,1.0,15,0,neck,easy
38,Neck pushups back,40,1.0,5,0,neck,easy
39,Raise leg. Left,30,1.0,2,0,legs,hard
40,Raise leg. Left,30,1.0,2,0,legs,hard
41,Breathing break,15,1.0,0,0,rest,rest
42,Lounge type 1,4,3.0,5,0,legs,easy
43,Lounge type 2,4,3.0,5,10,legs,easy
44,Breathing break,15,1.0,0,0,rest,rest
45,BULGARIAN SPLIT SQUATS left,10,1.1,7,0,legs,hard
46,BULGARIAN SPLIT SQUATS right,10,1.1,4,0,legs,hard
47,One Legged standing stretch left,7,1.0,2,0,rest,rest
48,One Legged standing stretch right,7,1.0,2,0,rest,rest
49,Breathing break,15,1.0,0,0,rest,rest`;

const App: React.FC = () => {
  const [exercises, setExercises] = useState<Exercise[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('voicecoach_exercises');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed) && parsed.length > 0) {
            setExercises(parsed);
            return;
        }
      } catch (e) {
        console.error('Failed to parse exercises');
      }
    }
    
    // Fallback to default sequence if no last used version exists
    const defaultExercises = importFromCSV(DEFAULT_CSV_DATA);
    setExercises(defaultExercises);
    localStorage.setItem('voicecoach_exercises', JSON.stringify(defaultExercises));
  }, []);

  const saveExercises = (newExercises: Exercise[]) => {
    setExercises(newExercises);
    localStorage.setItem('voicecoach_exercises', JSON.stringify(newExercises));
  };

  const handleSaveExercise = (ex: Exercise) => {
    const existingIndex = exercises.findIndex(e => e.id === ex.id);
    let updated;
    if (existingIndex >= 0) {
      updated = [...exercises];
      updated[existingIndex] = ex;
    } else {
      updated = [...exercises, ex];
    }
    saveExercises(updated);
  };

  const handleDuplicateExercise = (originalId: string, copyData: Omit<Exercise, 'id'>) => {
    const originalIndex = exercises.findIndex(e => e.id === originalId);
    const newEx: Exercise = {
        ...copyData,
        id: crypto.randomUUID(),
        name: `${copyData.name} (Copy)`
    };
    
    const updated = [...exercises];
    if (originalIndex !== -1) {
        // Insert immediately after original
        updated.splice(originalIndex + 1, 0, newEx);
    } else {
        updated.push(newEx);
    }
    saveExercises(updated);
  };

  const handleDeleteExercise = (id: string) => {
    const updated = exercises.filter(e => e.id !== id);
    saveExercises(updated);
  };

  const handleClearExercises = () => {
    saveExercises([]);
  };

  return (
    <HashRouter>
      <div className="min-h-screen bg-dark text-slate-100 font-sans selection:bg-primary/30 selection:text-primary">
        <Routes>
          <Route 
            path="/" 
            element={
              <Home 
                exercises={exercises} 
                onDelete={handleDeleteExercise} 
                onReorder={saveExercises}
              />
            } 
          />
          <Route 
            path="/edit/:id" 
            element={
              <ExerciseEditor 
                exercises={exercises} 
                onSave={handleSaveExercise} 
                onDuplicate={handleDuplicateExercise}
              />
            } 
          />
          <Route 
            path="/data" 
            element={
              <DataManagement 
                exercises={exercises} 
                onImport={saveExercises} 
                onClear={handleClearExercises}
              />
            } 
          />
          <Route path="/workout" element={<WorkoutSession exercises={exercises} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </HashRouter>
  );
};

export default App;
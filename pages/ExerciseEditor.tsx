import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Save, Timer, Hourglass, Wind, Copy } from 'lucide-react';
import { Exercise } from '../types';
import { Button } from '../components/Button';

interface ExerciseEditorProps {
  exercises: Exercise[];
  onSave: (ex: Exercise) => void;
  onDuplicate: (originalId: string, ex: Omit<Exercise, 'id'>) => void;
}

interface InputGroupProps {
  label: string;
  icon: React.ElementType;
  name: string;
  value: string | number;
  step?: string;
  type?: string;
  min?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const InputGroup: React.FC<InputGroupProps> = ({ 
  label, icon: Icon, name, value, step = "1", type = "number", min = "0", onChange 
}) => (
  <div className="space-y-2">
    <label className="text-xs font-bold text-slate-500 flex items-center gap-1.5 uppercase tracking-wider">
      <Icon size={14} className="text-primary" /> {label}
    </label>
    <input
      type={type}
      name={name}
      min={min}
      step={step}
      value={value}
      placeholder="0"
      onChange={onChange}
      required
      className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-primary transition-all font-mono placeholder:text-slate-700"
    />
  </div>
);

const RepeatIcon = ({size, className}: {size: number, className?: string}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
);

const ExerciseEditor: React.FC<ExerciseEditorProps> = ({ exercises, onSave, onDuplicate }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const returnState = location.state as { returnPath?: string; returnIndex?: number } | null;
  
  const [formData, setFormData] = useState<Omit<Exercise, 'id'>>({
    name: '',
    reps: 0,
    repDuration: 0,
    prepTime: 0,
    coolingTime: 0
  });

  useEffect(() => {
    if (id && id !== 'new') {
      const existing = exercises.find(e => e.id === id);
      if (existing) {
        setFormData({
            name: existing.name,
            reps: existing.reps,
            repDuration: existing.repDuration,
            prepTime: existing.prepTime,
            coolingTime: existing.coolingTime
        });
      }
    } else {
      // Explicitly ensure new exercises start with empty name and zeros
      setFormData({
        name: '',
        reps: 0,
        repDuration: 0,
        prepTime: 0,
        coolingTime: 0
      });
    }
  }, [id, exercises]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'name' ? value : (value === '' ? 0 : Number(value))
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalId = id === 'new' || !id ? crypto.randomUUID() : id;
    onSave({
      id: finalId,
      ...formData
    });
    
    // Check if we need to return to a specific path (like the workout session)
    if (returnState?.returnPath) {
        navigate(returnState.returnPath, { state: { initialIndex: returnState.returnIndex } });
    } else {
        navigate('/', { state: { focusId: finalId } });
    }
  };

  const handleDuplicateAction = () => {
    if (id && id !== 'new') {
        onDuplicate(id, formData);
        // Focus the original item when duplicating (usually stays on list)
        navigate('/', { state: { focusId: id } });
    }
  };

  const handleBack = () => {
    if (returnState?.returnPath) {
        navigate(returnState.returnPath, { state: { initialIndex: returnState.returnIndex } });
    } else {
        // If editing existing, focus it on return. If new, just go back.
        navigate('/', { state: { focusId: id !== 'new' ? id : undefined } });
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-dark flex flex-col">
      <header className="p-5 flex items-center gap-4 border-b border-white/5 sticky top-0 bg-dark/80 backdrop-blur-md z-10">
        <Button variant="icon" size="sm" onClick={handleBack} type="button">
          <ArrowLeft size={20} />
        </Button>
        <h1 className="text-lg font-bold text-white">
          {id === 'new' ? 'Add New' : 'Edit Exercise'}
        </h1>
      </header>

      <form onSubmit={handleSubmit} className="p-6 space-y-8 flex-1">
        <div className="space-y-2">
           <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Name</label>
           <input
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Exercise Name"
            required
            autoFocus
            className="w-full bg-slate-950 border border-white/10 rounded-2xl p-5 text-white text-lg font-bold focus:outline-none focus:border-primary transition-all placeholder:text-slate-700"
          />
        </div>

        <div className="bg-surface p-6 rounded-3xl border border-white/5 space-y-6">
            <div className="grid grid-cols-2 gap-5">
                <InputGroup label="Reps" icon={RepeatIcon} name="reps" value={formData.reps} min="0" onChange={handleChange} />
                <InputGroup label="Duration (s)" icon={Timer} name="repDuration" value={formData.repDuration} min="0" step="0.1" onChange={handleChange} />
            </div>
            <div className="h-px bg-white/5"></div>
            <div className="grid grid-cols-2 gap-5">
                <InputGroup label="Prep (s)" icon={Hourglass} name="prepTime" value={formData.prepTime} min="0" step="0.1" onChange={handleChange} />
                <InputGroup label="Rest (s)" icon={Wind} name="coolingTime" value={formData.coolingTime} min="0" step="0.1" onChange={handleChange} />
            </div>
        </div>

        <div className="pt-4 flex flex-col gap-3">
          <Button type="submit" fullWidth size="lg">
            <Save size={20} /> Save Changes
          </Button>
          {id !== 'new' && id && (
            <Button variant="secondary" type="button" fullWidth size="lg" onClick={handleDuplicateAction}>
              <Copy size={20} /> Duplicate Exercise
            </Button>
          )}
        </div>
      </form>
    </div>
  );
};

export default ExerciseEditor;
import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Upload, Trash2, Database, AlertTriangle } from 'lucide-react';
import { Exercise } from '../types';
import { exportToCSV, importFromCSV } from '../utils/csv';
import { Button } from '../components/Button';
import Toast, { ToastType } from '../components/Toast';
import { tts } from '../utils/tts';

interface DataManagementProps {
  exercises: Exercise[];
  onImport: (ex: Exercise[]) => void;
  onClear: () => void;
}

const DataManagement: React.FC<DataManagementProps> = ({ exercises, onImport, onClear }) => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice settings
  const [voiceInfo, setVoiceInfo] = useState(tts.getVoice());
  const [voices, setVoices] = useState<Array<{name: string; lang: string}>>([]);
  const [cacheStatus, setCacheStatus] = useState<{cached:number; total:number; missing:number} | null>(null);

  // Toast State
  const [toast, setToast] = useState<{ show: boolean, msg: string, type: ToastType }>({
    show: false, msg: '', type: 'success'
  });

  const showToast = (msg: string, type: ToastType = 'success') => {
    // Reset first to ensure animation replays
    setToast(prev => ({ ...prev, show: false }));
    // Use requestAnimationFrame for reliable DOM update cycle before reshowing
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setToast({ show: true, msg, type });
      });
    });
  };

  const refreshVoice = () => {
    try {
      setVoiceInfo(tts.getVoice());
      setVoices(tts.listNativeVoices());
      import('../utils/guidance').then(m => m.getCacheStatus(exercises)).then(setCacheStatus).catch(() => {});
    } catch {
      // ignore
    }
  };

  const testVoice = async () => {
    try {
      await tts.speak('Voice test. Three, two, one.', true);
      setTimeout(() => refreshVoice(), 150);
    } catch {
      refreshVoice();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
            const text = evt.target?.result as string;
            const imported = importFromCSV(text);
            if (imported.length > 0) {
              onImport(imported);
              showToast(`Imported ${imported.length} exercises successfully`, 'success');
            } else {
              showToast('No valid exercises found in CSV', 'error');
            }
        } catch (err) {
            showToast('Failed to parse CSV file', 'error');
        }
      };
      reader.readAsText(file);
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleExport = () => {
    if (exercises.length === 0) {
        showToast('No exercises to export', 'info');
        return;
    }
    exportToCSV(exercises);
    showToast('Exercises exported to CSV', 'success');
  }

  const handleClear = () => {
    if (exercises.length === 0) {
        showToast('Database is already empty', 'info');
        return;
    }

    // Explicit window.confirm check
    const confirmed = window.confirm("Are you sure you want to delete ALL exercises? This cannot be undone.");
    if (confirmed) {
      onClear();
      showToast('All data has been cleared', 'success');
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-dark flex flex-col relative">
      <Toast
        isVisible={toast.show}
        message={toast.msg}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, show: false }))}
      />

      <header className="p-4 flex items-center gap-4 border-b border-slate-800/60 bg-dark/50 backdrop-blur-md sticky top-0 z-10">
        <Button variant="icon" size="sm" onClick={() => navigate('/')}>
          <ArrowLeft size={20} />
        </Button>
        <h1 className="text-lg font-bold text-white">Data & Settings</h1>
      </header>

      <div className="p-4 space-y-6 flex-1">

        {/* Stats Card */}
        <div className="bg-slate-800/40 p-5 rounded-xl border border-slate-700/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                    <Database size={20} />
                </div>
                <div>
                    <h3 className="text-sm font-medium text-slate-200">Current Database</h3>
                    <p className="text-xs text-slate-500">
                        {exercises.length} {exercises.length === 1 ? 'record' : 'records'} stored
                    </p>
                </div>
            </div>
        </div>

        {/* Voice / TTS */}
        <div className="bg-slate-800/40 p-5 rounded-xl border border-slate-700/50 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-slate-200">Voice</h3>
              <p className="text-xs text-slate-500">Engine: <span className="text-slate-300">{voiceInfo.lastEngine}</span>{voiceInfo.lastCloudError ? <span className="text-red-400"> • cloud error: {voiceInfo.lastCloudError}</span> : null}</p>
              <p className="text-[11px] text-slate-500">Cache: {cacheStatus ? <span className="text-slate-300">{cacheStatus.cached}/{cacheStatus.total}</span> : <span className="text-slate-400">—</span>} {cacheStatus && cacheStatus.missing > 0 ? <span className="text-amber-300">• missing {cacheStatus.missing}</span> : null}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" type="button" onClick={() => { refreshVoice(); showToast('Voice info refreshed', 'info'); }}>Refresh</Button>
              <Button variant="primary" size="sm" type="button" onClick={() => { tts.warmup(); testVoice(); }}>Test</Button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-200">ElevenLabs guidance</p>
              <p className="text-[11px] text-slate-500">Generate a better, human voice for exercise announcements + motivation (cached on-device).</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={async () => {
                try {
                  showToast('Generating guidance… keep this screen open', 'info');
                  // lazy import to keep initial bundle small
                  const mod = await import('../utils/guidance');
                  const { getOrGenerateCore, getOrGenerateExerciseAnnounce, getOrGenerateMotivation } = mod;
                  // Core clips (numbers + go/rest)
                  showToast('Generating core voice clips…', 'info');
                  for (let n = 1; n <= 180; n++) {
                    await getOrGenerateCore(exercises, `n:${n}`);
                  }
                  await getOrGenerateCore(exercises, 'prep_motivation');
                  await getOrGenerateCore(exercises, 'prep_motivation_2');
                  await getOrGenerateCore(exercises, 'cool_motivation');
                  // rotating motivation lines
                  for (let i = 1; i <= 10; i++) {
                    await getOrGenerateCore(exercises, `mot_${i}`);
                  }
                  await getOrGenerateCore(exercises, 'get_ready');
                  await getOrGenerateCore(exercises, 'go_1');
                  await getOrGenerateCore(exercises, 'go_2');
                  await getOrGenerateCore(exercises, 'go_3');
                  await getOrGenerateCore(exercises, 'go_4');
                  await getOrGenerateCore(exercises, 'go_5');
                  await getOrGenerateCore(exercises, 'rest');
                  await getOrGenerateCore(exercises, 'workout_complete');

                  // Per-exercise announce clips (NAME ONLY)
                  for (let i = 0; i < exercises.length; i++) {
                    const ex = exercises[i];
                    showToast(`Generating ${i + 1}/${exercises.length}: ${ex.name}`, 'info');
                    await getOrGenerateExerciseAnnounce(exercises, ex);
                    // Sprinkle motivation (about every 4th exercise)
                    if (i % 4 === 0) {
                      await getOrGenerateMotivation(exercises, ex);
                    }
                  }

                  showToast('Guidance generated ✅', 'success');
                  refreshVoice();
                  try { const cs = await (await import('../utils/guidance')).getCacheStatus(exercises); setCacheStatus(cs); } catch {}
                } catch (e: any) {
                  showToast(`Guidance failed: ${e?.message || 'unknown error'}`, 'error');
                }
              }}
            >
              Generate
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Mode</label>
              <select
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
                value={voiceInfo.preferCloud ? 'cloud' : 'native'}
                onChange={(e) => {
                  const preferCloud = e.target.value === 'cloud';
                  tts.setVoice({ preferCloud });
                  refreshVoice();
                }}
              >
                <option value="native">Native (recommended on iPhone)</option>
                <option value="cloud">Cloud (StreamElements)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Native voice</label>
              <select
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
                value={voiceInfo.nativeVoiceName ?? ''}
                onClick={() => { if (!voices.length) refreshVoice(); }}
                onChange={(e) => {
                  const name = e.target.value || null;
                  tts.setVoice({ nativeVoiceName: name, preferCloud: false });
                  refreshVoice();
                }}
              >
                <option value="">Auto (best available)</option>
                {voices.map(v => (
                  <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            Tip (iPhone): install higher quality voices in iOS Settings → Accessibility → Spoken Content → Voices.
          </p>
        </div>

        {/* Actions Grid */}
        <div className="grid grid-cols-2 gap-3">
            <button
                onClick={handleExport}
                className="bg-slate-800/40 hover:bg-slate-700/50 p-4 rounded-xl border border-slate-700/50 flex flex-col items-center justify-center gap-2 text-slate-300 transition-colors group"
                type="button"
            >
                <div className="p-3 bg-blue-500/10 rounded-full text-blue-400 group-hover:scale-110 transition-transform">
                    <Download size={24} />
                </div>
                <span className="text-sm font-medium">Export CSV</span>
            </button>

            <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-slate-800/40 hover:bg-slate-700/50 p-4 rounded-xl border border-slate-700/50 flex flex-col items-center justify-center gap-2 text-slate-300 transition-colors group"
                type="button"
            >
                 <div className="p-3 bg-purple-500/10 rounded-full text-purple-400 group-hover:scale-110 transition-transform">
                    <Upload size={24} />
                </div>
                <span className="text-sm font-medium">Import CSV</span>
                <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
            </button>
        </div>

        <div className="h-px bg-slate-800/50 my-2"></div>

        {/* Danger Zone */}
        <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-4">
            <div className="flex items-center gap-2 text-red-400 mb-3">
                <AlertTriangle size={18} />
                <span className="text-sm font-semibold">Danger Zone</span>
            </div>
            <p className="text-xs text-red-400/70 mb-4 leading-relaxed">
                Clearing data will permanently remove all your exercises. Make sure you have exported a backup if needed.
            </p>
            <Button variant="danger" onClick={handleClear} fullWidth size="sm" type="button">
                <Trash2 size={16} /> Clear All Data
            </Button>
        </div>

      </div>

      <div className="p-6 text-center text-[10px] text-slate-700">
         v1.2.0 • Local Storage • Alex Workout
      </div>
    </div>
  );
};

export default DataManagement;
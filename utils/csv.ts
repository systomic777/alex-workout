import { Exercise } from '../types';

export const exportToCSV = (exercises: Exercise[]) => {
  const headers = ['id', 'name', 'reps', 'repDuration', 'prepTime', 'coolingTime'];
  const csvContent = [
    headers.join(','),
    ...exercises.map(ex => 
      `${ex.id},"${ex.name.replace(/"/g, '""')}",${ex.reps},${ex.repDuration},${ex.prepTime},${ex.coolingTime}`
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `workout_export_${new Date().toISOString().slice(0, 10)}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const parseNumber = (val: string, fallback: number, isFloat: boolean = true): number => {
  if (val === undefined || val === null || val.trim() === '') return fallback;
  const num = isFloat ? parseFloat(val) : parseInt(val, 10);
  return isNaN(num) ? fallback : num;
};

export const importFromCSV = (csvText: string): Exercise[] => {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  // Simple CSV parser assuming standard format from export
  const result: Exercise[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Handle quoted strings broadly
    const parts: string[] = [];
    let current = '';
    let inQuote = false;
    
    for (let char of line) {
      if (char === '"') {
        inQuote = !inQuote;
      } else if (char === ',' && !inQuote) {
        parts.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    parts.push(current);

    if (parts.length >= 6) {
      result.push({
        id: parts[0] || crypto.randomUUID(),
        name: parts[1].replace(/""/g, '"').trim(),
        reps: parseNumber(parts[2], 10, false),
        repDuration: parseNumber(parts[3], 5),
        prepTime: parseNumber(parts[4], 5),
        coolingTime: parseNumber(parts[5], 5), // Default to 5 only if NaN or empty, preserves 0
      });
    }
  }
  return result;
};
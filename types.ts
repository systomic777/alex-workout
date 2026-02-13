export interface Exercise {
  id: string;
  name: string;
  reps: number;
  repDuration: number; // in seconds
  prepTime: number; // in seconds
  coolingTime: number; // in seconds
}

export enum WorkoutPhase {
  IDLE = 'IDLE',
  ANNOUNCE = 'ANNOUNCE',
  PREP = 'PREP',
  WORK = 'WORK',
  COOL = 'COOL',
  FINISHED = 'FINISHED',
}
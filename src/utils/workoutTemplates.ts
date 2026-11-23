import { Step } from './types';

export type WorkoutTemplateId = 'over-under' | 'sweet-spot' | 'z2-long';

export interface WorkoutTemplate {
  id: WorkoutTemplateId;
  name: string;
  description: string;
  durationMinutes: number;
  steps: Step[];
}

const step = (label: string, minutes: number, watts: number, id: string): Omit<Step, 'index' | 'total'> => ({
  id, label, minutes, watts
});

export function getWorkoutTemplates(ftp: number): WorkoutTemplate[] {
  const watts = (percent: number) => Math.round(ftp * percent / 100);
  const overUnder: Omit<Step, 'index' | 'total'>[] = [
    step('Warm-up · build', 10, watts(60), 'ou-warm'),
    ...Array.from({ length: 3 }, (_, block) => [
      ...Array.from({ length: 4 }, (_, rep) => [
        step(`Under · Block ${block + 1}`, 2, watts(95), `ou-under-${block}-${rep}`),
        step(`Over · Block ${block + 1}`, 1, watts(105), `ou-over-${block}-${rep}`)
      ]).flat(),
      ...(block < 2 ? [step('Recovery between blocks', 3, watts(55), `ou-recovery-${block}`)] : [])
    ]).flat(),
    step('Cool-down', 6, watts(45), 'ou-cool')
  ];
  const sweetSpot: Omit<Step, 'index' | 'total'>[] = [
    step('Warm-up', 15, watts(60), 'ss-warm'),
    ...Array.from({ length: 3 }, (_, block) => [
      step(`Sweet spot · ${block + 1}/3`, 10, watts(90), `ss-work-${block}`),
      ...(block < 2 ? [step('Recovery', 5, watts(55), `ss-recovery-${block}`)] : [])
    ]).flat(),
    step('Cool-down', 5, watts(45), 'ss-cool')
  ];
  const z2: Omit<Step, 'index' | 'total'>[] = [
    step('Warm-up · easy build', 10, watts(55), 'z2-warm'),
    step('Endurance · Zone 2', 70, watts(65), 'z2-main'),
    step('Cool-down', 10, watts(50), 'z2-cool')
  ];

  const finish = (raw: Omit<Step, 'index' | 'total'>[]) => raw.map((s, index) => ({ ...s, index: index + 1, total: raw.length }));
  const duration = (steps: Step[]) => steps.reduce((total, item) => total + item.minutes, 0);

  return [
    { id: 'over-under', name: 'Over/Under', description: '3 × 12 min alternating 2 min under / 1 min over threshold.', steps: finish(overUnder), durationMinutes: duration(finish(overUnder)) },
    { id: 'sweet-spot', name: 'Sweet Spot', description: '3 × 10 min at 90% FTP with easy recoveries.', steps: finish(sweetSpot), durationMinutes: duration(finish(sweetSpot)) },
    { id: 'z2-long', name: 'Z2 Long Ride', description: 'Steady aerobic endurance with a gentle warm-up and cool-down.', steps: finish(z2), durationMinutes: duration(finish(z2)) }
  ];
}

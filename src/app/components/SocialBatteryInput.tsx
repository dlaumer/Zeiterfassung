import { FieldHelp } from './FieldHelp';
import { useId } from 'react';
import { useI18n } from '../i18n/i18n';

const levels = [
  { value: 1, emoji: '😞', color: 'bg-red-200/50', selectedColor: 'bg-red-700' },
  { value: 2, emoji: '🙁', color: 'bg-red-100/60', selectedColor: 'bg-red-400' },
  { value: 3, emoji: '😐', color: 'bg-yellow-100/60', selectedColor: 'bg-yellow-400' },
  { value: 4, emoji: '🙂', color: 'bg-green-100/60', selectedColor: 'bg-green-300' },
  { value: 5, emoji: '😄', color: 'bg-green-200/50', selectedColor: 'bg-green-600' },
];

interface SocialBatteryInputProps {
  value: number;
  onChange: (value: number) => void;
  participantRole: 'student' | 'faculty';
}

export function SocialBatteryInput({ value, onChange, participantRole }: SocialBatteryInputProps) {
  const { t } = useI18n();
  const id = useId();

  return (
    <div role="group" aria-labelledby={`${id}-label`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <span id={`${id}-label`}>{t(`socialBattery.${participantRole}`)}</span>
        <FieldHelp title={t(`socialBattery.${participantRole}`)} text={t(`fieldHelp.battery.${participantRole}`)} />
      </div>
      <div className="relative w-44 shrink-0 pb-1 pr-1">
        <div className="pointer-events-none absolute bottom-0 left-0 right-1 h-8 rounded-md border border-gray-300" aria-hidden="true" />
        <div className="pointer-events-none absolute bottom-2.5 right-0 h-3 w-1 rounded-r-sm bg-gray-300" aria-hidden="true" />
        <div className="relative flex gap-1 px-1 pt-1">
          {levels.map((level) => (
            <label key={level.value} className="group min-w-0 flex-1 cursor-pointer">
              <input
                type="radio"
                name={id}
                value={level.value}
                checked={value === level.value}
                onChange={() => onChange(level.value)}
                aria-label={`${level.value}/5: ${t(`socialBattery.level${level.value}`)}`}
                className="peer sr-only"
              />
              <span className="flex flex-col items-center gap-2 rounded-sm peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-indigo-500">
                <span className={`text-xl leading-none transition-all ${value === level.value ? '-translate-y-0.5 scale-110 opacity-100' : 'opacity-50 group-hover:opacity-80'}`} aria-hidden="true">{level.emoji}</span>
                <span className={`h-6 w-full rounded-sm transition-colors ${level.value <= value ? level.selectedColor : `${level.color} group-hover:brightness-95`}`} aria-hidden="true" />
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

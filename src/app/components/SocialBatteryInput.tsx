import { FieldHelp } from './FieldHelp';
import { useId } from 'react';
import { useI18n } from '../i18n/i18n';

const levels = [
  { value: 1, emoji: '😞', from: '#d94f5c', to: '#e78086' },
  { value: 2, emoji: '🙁', from: '#e78086', to: '#b7a5a7' },
  { value: 3, emoji: '🙂', from: '#b7a5a7', to: '#a1b7aa' },
  { value: 4, emoji: '😄', from: '#a1b7aa', to: '#6abf8c' },
  { value: 5, emoji: '🤩', from: '#6abf8c', to: '#2ca468' },
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
      <div className="relative w-44 shrink-0 pb-1.5 pr-1.5">
        <div className="pointer-events-none absolute bottom-0 left-0 right-1.5 h-11 rounded-xl border-[3px] border-gray-700 bg-white shadow-sm" aria-hidden="true" />
        <div className="pointer-events-none absolute bottom-3 right-0 h-5 w-1.5 rounded-r bg-gray-700" aria-hidden="true" />
        <div className="relative flex gap-1 pl-1.5 pr-1.5 pt-1">
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
              <span className="flex flex-col items-center gap-3 rounded-sm peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-indigo-500">
                <span className={`relative text-xl leading-none transition-all ${value === level.value ? '-translate-y-0.5 scale-110 opacity-100' : 'opacity-50 group-hover:opacity-80'}`} aria-hidden="true">
                  {level.emoji}
                  {level.value === 5 && value === 5 && <span className="absolute -right-1.5 -top-1 text-xs">✨</span>}
                </span>
                <span
                  className={`h-8 w-full rounded-md transition-opacity duration-200 ${level.value <= value ? 'opacity-100' : 'opacity-25 group-hover:opacity-50'}`}
                  style={{ background: `linear-gradient(to right, ${level.from}, ${level.to})` }}
                  aria-hidden="true"
                />
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

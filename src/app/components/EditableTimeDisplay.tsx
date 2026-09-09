import { useState, useRef, useEffect } from 'react';
import { useI18n } from '../i18n/i18n';

interface EditableTimeDisplayProps {
  value: number;
  onChange: (value: number) => void;
  max?: number;
  clampToMax?: boolean;
  prefix?: string;
  displayClassName?: string;
  previousValue?: number;
}

const splitTime = (hoursValue: number) => {
  const totalMinutes = Math.max(0, Math.round(hoursValue * 60));

  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60
  };
};

export const formatTime = (hoursValue: number) => {
  const { hours, minutes } = splitTime(hoursValue);

  return `${hours}h ${minutes}min`;
};

export function EditableTimeDisplay({ previousValue, ...props }: EditableTimeDisplayProps) {
  const { t } = useI18n();
  const deltaMinutes = previousValue === undefined ? 0 : Math.round(props.value * 60) - Math.round(previousValue * 60);
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
      <TimeValueEditor {...props} />
      {deltaMinutes !== 0 && <span
        title={t('dailyEntry.changeFromSaved')}
        className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${deltaMinutes > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}
      >
        <span className="sr-only">{t('dailyEntry.changeFromSaved')}: </span>
        {deltaMinutes > 0 ? '+' : '−'}{formatTime(Math.abs(deltaMinutes) / 60)}
      </span>}
    </div>
  );
}

function TimeValueEditor({
  value,
  onChange,
  max = 24,
  clampToMax = true,
  prefix = '',
  displayClassName = ''
}: EditableTimeDisplayProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editHours, setEditHours] = useState('0');
  const [editMinutes, setEditMinutes] = useState('0');
  const inputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const setEditFields = (hoursValue: number) => {
    const { hours, minutes } = splitTime(hoursValue);
    setEditHours(String(hours));
    setEditMinutes(String(minutes));
  };

  useEffect(() => {
    if (!isEditing) {
      setEditFields(value);
    }
  }, [value, isEditing]);

  const handleClick = () => {
    setIsEditing(true);
    setEditFields(value);
  };

  const commitEdit = () => {
    const hours = parseInt(editHours, 10);
    const minutes = parseInt(editMinutes, 10);

    if (!isNaN(hours) && !isNaN(minutes) && hours >= 0 && minutes >= 0 && minutes < 60) {
      const maxMinutes = Math.round(max * 60);
      const enteredMinutes = hours * 60 + minutes;
      const totalMinutes = clampToMax ? Math.min(enteredMinutes, maxMinutes) : enteredMinutes;
      onChange(totalMinutes / 60);
    }

    setIsEditing(false);
  };

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!editorRef.current?.contains(e.relatedTarget as Node | null)) {
      commitEdit();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      commitEdit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  if (isEditing) {
    return (
      <div
        ref={editorRef}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="flex items-center gap-1 text-sm font-semibold text-gray-900"
      >
        <input
          ref={inputRef}
          type="number"
          value={editHours}
          onChange={(e) => setEditHours(e.target.value)}
          min="0"
          max={clampToMax ? Math.floor(max) : undefined}
          step="1"
          aria-label="Hours"
          className="w-12 text-right border border-indigo-300 rounded px-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <span>h</span>
        <input
          type="number"
          value={editMinutes}
          onChange={(e) => setEditMinutes(e.target.value)}
          min="0"
          max="59"
          step="1"
          aria-label="Minutes"
          className="w-12 text-right border border-indigo-300 rounded px-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <span>min</span>
      </div>
    );
  }

  return (
    <span
      onClick={handleClick}
      className={`text-sm font-semibold text-gray-900 cursor-pointer hover:text-indigo-600 hover:underline ${displayClassName}`}
    >
      {prefix}{formatTime(value)}
    </span>
  );
}

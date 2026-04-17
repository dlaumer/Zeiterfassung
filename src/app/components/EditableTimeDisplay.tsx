import { useState, useRef, useEffect } from 'react';

interface EditableTimeDisplayProps {
  value: number;
  onChange: (value: number) => void;
  max?: number;
}

export function EditableTimeDisplay({ value, onChange, max = 24 }: EditableTimeDisplayProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value.toFixed(1));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) {
      setEditValue(value.toFixed(1));
    }
  }, [value, isEditing]);

  const handleClick = () => {
    setIsEditing(true);
    setEditValue(value.toFixed(1));
  };

  const handleBlur = () => {
    const numValue = parseFloat(editValue);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= max) {
      onChange(numValue);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
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
      <input
        ref={inputRef}
        type="number"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        min="0"
        max={max}
        step="0.1"
        className="w-16 text-sm font-semibold text-gray-900 text-right border border-indigo-300 rounded px-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    );
  }

  return (
    <span
      onClick={handleClick}
      className="text-sm font-semibold text-gray-900 cursor-pointer hover:text-indigo-600 hover:underline"
    >
      {value.toFixed(1)}h
    </span>
  );
}

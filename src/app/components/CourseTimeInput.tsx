import { Slider } from '@radix-ui/react-slider';
import { Clock } from 'lucide-react';
import { useState } from 'react';

interface CourseTimeInputProps {
  courseName: string;
  hours: number;
  onChange: (hours: number) => void;
  onRemove: () => void;
}

export function CourseTimeInput({ courseName, hours, onChange, onRemove }: CourseTimeInputProps) {
  const [showManualInput, setShowManualInput] = useState(false);

  const handleSliderChange = (value: number[]) => {
    onChange(value[0]);
  };

  const handleManualChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= 0 && value <= 12) {
      onChange(value);
    }
  };

  return (
    <div className="bg-gray-50 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-gray-800">{courseName}</h4>
        <button
          onClick={onRemove}
          className="text-sm text-gray-400 hover:text-red-500 transition-colors"
        >
          Remove
        </button>
      </div>

      <div className="space-y-2">
        {!showManualInput ? (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Time spent</span>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-500" />
                <span className="font-semibold text-gray-900">{hours.toFixed(1)}h</span>
              </div>
            </div>
            <Slider
              value={[hours]}
              onValueChange={handleSliderChange}
              max={12}
              step={0.25}
              className="relative flex items-center select-none touch-none w-full h-5"
            >
              <div className="relative flex-1 h-2 bg-gray-200 rounded-full">
                <div
                  className="absolute h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${(hours / 12) * 100}%` }}
                />
              </div>
              <div
                className="block w-5 h-5 bg-white border-2 border-indigo-500 rounded-full shadow-lg hover:scale-110 transition-transform cursor-pointer"
                style={{
                  position: 'absolute',
                  left: `calc(${(hours / 12) * 100}% - 10px)`
                }}
              />
            </Slider>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={hours}
              onChange={handleManualChange}
              min="0"
              max="12"
              step="0.5"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-600">hours</span>
          </div>
        )}

        <button
          onClick={() => setShowManualInput(!showManualInput)}
          className="text-xs text-indigo-600 hover:text-indigo-700"
        >
          {showManualInput ? 'Use slider' : 'Manual input'}
        </button>
      </div>
    </div>
  );
}

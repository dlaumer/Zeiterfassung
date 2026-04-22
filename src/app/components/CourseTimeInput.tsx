import { Slider } from '@radix-ui/react-slider';
import { Clock } from 'lucide-react';
import { EditableTimeDisplay } from './EditableTimeDisplay';

interface CourseTimeInputProps {
  courseName: string;
  hours: number;
  onChange: (hours: number) => void;
  onRemove: () => void;
}

export function CourseTimeInput({ courseName, hours, onChange, onRemove }: CourseTimeInputProps) {
  const handleSliderChange = (value: number[]) => {
    onChange(value[0]);
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
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Time spent</span>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-500" />
            <EditableTimeDisplay
              value={hours}
              onChange={onChange}
              max={12}
            />
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
      </div>
    </div>
  );
}

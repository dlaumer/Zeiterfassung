import { Slider } from '@radix-ui/react-slider';

interface SubjectTimeInputProps {
  subjectName: string;
  subjectColor: string;
  classTime: number;
  selfStudyTime: number;
  onClassTimeChange: (time: number) => void;
  onSelfStudyTimeChange: (time: number) => void;
  statusTag?: string | null;
  isFaded?: boolean;
}

export function SubjectTimeInput({
  subjectName,
  subjectColor,
  classTime,
  selfStudyTime,
  onClassTimeChange,
  onSelfStudyTimeChange,
  statusTag,
  isFaded = false
}: SubjectTimeInputProps) {
  return (
    <div className={`bg-gray-50 rounded-xl p-4 space-y-4 transition-opacity ${isFaded ? 'opacity-60' : ''}`}>
      {/* Subject Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: subjectColor }}
          />
          <span className="font-medium text-gray-800">{subjectName}</span>
        </div>
        {statusTag && (
          <span className={`text-xs px-2 py-1 rounded-full ${
            statusTag === 'Filled before'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-200 text-gray-600'
          }`}>
            {statusTag}
          </span>
        )}
      </div>

      {/* Class Time Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-600">Class Time</label>
          <span className="text-sm font-semibold text-gray-900">{classTime.toFixed(1)}h</span>
        </div>
        <Slider
          value={[classTime]}
          onValueChange={(value) => onClassTimeChange(value[0])}
          max={8}
          step={0.25}
          className="relative flex items-center select-none touch-none w-full h-5"
        >
          <div className="relative flex-1 h-2 bg-gray-200 rounded-full">
            <div
              className="absolute h-full rounded-full transition-all"
              style={{
                backgroundColor: subjectColor,
                width: `${(classTime / 8) * 100}%`
              }}
            />
          </div>
          <div
            className="block w-5 h-5 bg-white border-2 rounded-full shadow-lg hover:scale-110 transition-transform cursor-pointer"
            style={{
              borderColor: subjectColor,
              position: 'absolute',
              left: `calc(${(classTime / 8) * 100}% - 10px)`
            }}
          />
        </Slider>
      </div>

      {/* Self Study Time Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-600">Self Study Time</label>
          <span className="text-sm font-semibold text-gray-900">{selfStudyTime.toFixed(1)}h</span>
        </div>
        <Slider
          value={[selfStudyTime]}
          onValueChange={(value) => onSelfStudyTimeChange(value[0])}
          max={8}
          step={0.25}
          className="relative flex items-center select-none touch-none w-full h-5"
        >
          <div className="relative flex-1 h-2 bg-gray-200 rounded-full">
            <div
              className="absolute h-full rounded-full transition-all"
              style={{
                backgroundColor: subjectColor,
                opacity: 0.6,
                width: `${(selfStudyTime / 8) * 100}%`
              }}
            />
          </div>
          <div
            className="block w-5 h-5 bg-white border-2 rounded-full shadow-lg hover:scale-110 transition-transform cursor-pointer"
            style={{
              borderColor: subjectColor,
              position: 'absolute',
              left: `calc(${(selfStudyTime / 8) * 100}% - 10px)`
            }}
          />
        </Slider>
      </div>
    </div>
  );
}

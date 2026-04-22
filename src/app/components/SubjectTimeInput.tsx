import { Slider } from '@radix-ui/react-slider';
import { EditableTimeDisplay } from './EditableTimeDisplay';
import { X } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '../i18n/i18n';

interface SubjectTimeInputProps {
  subjectName: string;
  subjectColor: string;
  classTime: number;
  selfStudyTime: number;
  onClassTimeChange: (time: number) => void;
  onSelfStudyTimeChange: (time: number) => void;
  statusTag?: string | null;
  isFaded?: boolean;
  onRemove?: () => void;
  isAdditionalHours?: boolean;
}

export function SubjectTimeInput({
  subjectName,
  subjectColor,
  classTime,
  selfStudyTime,
  onClassTimeChange,
  onSelfStudyTimeChange,
  statusTag,
  isFaded = false,
  onRemove,
  isAdditionalHours = false
}: SubjectTimeInputProps) {
  const { t } = useI18n();
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const handleRemoveClick = () => {
    if (classTime > 0 || selfStudyTime > 0) {
      setShowRemoveConfirm(true);
    } else if (onRemove) {
      onRemove();
    }
  };

  const confirmRemove = () => {
    if (onRemove) {
      onRemove();
    }
    setShowRemoveConfirm(false);
  };

  return (
    <>
      <div className={`bg-gray-50 rounded-xl p-4 space-y-4 transition-opacity relative ${isFaded ? 'opacity-60' : ''}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 shrink-0 rounded-full"
              style={{ backgroundColor: subjectColor }}
            />
            <span className="font-medium text-gray-800">{subjectName}</span>
          </div>
          <div className="flex items-center gap-2">
            {statusTag && (
              <span className={`text-xs px-2 py-1 rounded-full ${
                statusTag === t('dailyEntry.filledBefore')
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {statusTag}
              </span>
            )}
            {onRemove && !statusTag && (
              <button
                onClick={handleRemoveClick}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            )}
          </div>
        </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-600">{t('subject.classTime')}</label>
          <EditableTimeDisplay
            value={classTime}
            onChange={onClassTimeChange}
            max={24}
            prefix={isAdditionalHours && statusTag === t('dailyEntry.filledBefore') && classTime > 0 ? '+' : ''}
            displayClassName={isAdditionalHours && statusTag === t('dailyEntry.filledBefore') && classTime > 0 ? 'text-green-600' : ''}
          />
        </div>
        <Slider
          value={[Math.min(classTime, 8)]}
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
                width: `${(Math.min(classTime, 8) / 8) * 100}%`
              }}
            />
          </div>
          <div
            className="block w-5 h-5 bg-white border-2 rounded-full shadow-lg hover:scale-110 transition-transform cursor-pointer"
            style={{
              borderColor: subjectColor,
              position: 'absolute',
              left: `calc(${(Math.min(classTime, 8) / 8) * 100}% - 10px)`
            }}
          />
        </Slider>
        <p className="text-xs text-gray-500 italic">{t('subject.lessonHint')}</p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-600">{t('subject.selfStudy')}</label>
          <EditableTimeDisplay
            value={selfStudyTime}
            onChange={onSelfStudyTimeChange}
            max={24}
            prefix={isAdditionalHours && statusTag === t('dailyEntry.filledBefore') && selfStudyTime > 0 ? '+' : ''}
            displayClassName={isAdditionalHours && statusTag === t('dailyEntry.filledBefore') && selfStudyTime > 0 ? 'text-green-600' : ''}
          />
        </div>
        <Slider
          value={[Math.min(selfStudyTime, 8)]}
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
                width: `${(Math.min(selfStudyTime, 8) / 8) * 100}%`
              }}
            />
          </div>
          <div
            className="block w-5 h-5 bg-white border-2 rounded-full shadow-lg hover:scale-110 transition-transform cursor-pointer"
            style={{
              borderColor: subjectColor,
              position: 'absolute',
              left: `calc(${(Math.min(selfStudyTime, 8) / 8) * 100}% - 10px)`
            }}
          />
        </Slider>
        <p className="text-xs text-gray-500 italic">{t('subject.lessonHint')}</p>
      </div>
    </div>

    {showRemoveConfirm && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
          <h3 className="font-semibold text-gray-900 mb-3">{t('subject.removeTitle')}</h3>
          <p className="text-sm text-gray-600 mb-6">{t('subject.removeInfo')}</p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowRemoveConfirm(false)}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={confirmRemove}
              className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              {t('common.remove')}
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
}

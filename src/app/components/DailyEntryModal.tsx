import { X, Star, Bike, TrainFront, FileText, CheckCircle } from 'lucide-react';
import { format, endOfWeek } from 'date-fns';
import { useState, useEffect } from 'react';
import { SubjectTimeInput } from './SubjectTimeInput';
import { Slider } from '@radix-ui/react-slider';
import { useI18n } from '../i18n/i18n';
import { Subject, getSubjectDisplayName } from './CourseManagement';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { EditableTimeDisplay } from './EditableTimeDisplay';

interface SubjectTime {
  subjectId: string;
  classTime: number;
  selfStudyTime: number;
  hasClassEntry?: boolean;
  hasStudyEntry?: boolean;
}

interface Course {
  id: string;
  name: string;
  hours: number;
}

interface DailyEntry {
  date: string;
  courses: Course[];
  subjectTimes: SubjectTime[];
  reliability: number;
  adminEffort: number;
  commuteTime: number;
  structuralChanges?: number;
  comment: string;
  skipped: boolean;
}

interface DailyEntryModalProps {
  date: Date;
  onClose: () => void;
  onSave: (entry: DailyEntry) => Promise<void>;
  existingEntry: DailyEntry | null;
  availableCourses: string[];
  subjects: Subject[];
  defaultCommuteTime?: number;
  entryMode?: 'day' | 'week';
}

const DEFAULT_TIME_SLIDER_MAX = 5;

export function DailyEntryModal({ date, onClose, onSave, existingEntry, subjects, defaultCommuteTime = 0, entryMode = 'day' }: DailyEntryModalProps) {
  const { t, language } = useI18n();
  const [courses, setCourses] = useState<Course[]>([]);
  const [subjectTimes, setSubjectTimes] = useState<SubjectTime[]>([]);
  const [reliability, setReliability] = useState(0);
  const [adminEffort, setAdminEffort] = useState(0);
  const [commuteTime, setCommuteTime] = useState(0);
  const [structuralChanges, setStructuralChanges] = useState(0);
  const [adminEffortSliderMax, setAdminEffortSliderMax] = useState(DEFAULT_TIME_SLIDER_MAX);
  const [commuteTimeSliderMax, setCommuteTimeSliderMax] = useState(DEFAULT_TIME_SLIDER_MAX);
  const [comment, setComment] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showCloseWarning, setShowCloseWarning] = useState(false);
  const reEntryMode = existingEntry ? 'add' : null;
  const isAddMode = reEntryMode === 'add' && !!existingEntry;
  const isWeekly = entryMode === 'week';
  const periodEnd = endOfWeek(date, { weekStartsOn: 1 });
  const periodLabel = isWeekly
    ? `${format(date, 'MMMM d, yyyy')} - ${format(periodEnd, 'MMMM d, yyyy')}`
    : format(date, 'EEEE, MMMM d, yyyy');

  useEffect(() => {
    setCourses([]);
    setSubjectTimes(subjects.map(s => ({ subjectId: s.id, classTime: 0, selfStudyTime: 0 })));
    setReliability(existingEntry?.reliability ?? 0);
    const nextAdminEffort = isWeekly ? 0 : existingEntry?.adminEffort ?? 0;
    const nextCommuteTime = isWeekly ? 0 : existingEntry?.commuteTime ?? defaultCommuteTime;
    setAdminEffort(nextAdminEffort);
    setCommuteTime(nextCommuteTime);
    setStructuralChanges(0);
    setAdminEffortSliderMax(Math.max(DEFAULT_TIME_SLIDER_MAX, nextAdminEffort));
    setCommuteTimeSliderMax(Math.max(DEFAULT_TIME_SLIDER_MAX, nextCommuteTime));
    setComment(existingEntry?.comment ?? '');
  }, [existingEntry, subjects, defaultCommuteTime, isWeekly]);

  const handleSubjectClassTimeChange = (subjectId: string, time: number) => {
    setSubjectTimes(prev => {
      const existing = prev.find(st => st.subjectId === subjectId);
      if (existing) {
        return prev.map(st =>
          st.subjectId === subjectId ? { ...st, classTime: time } : st
        );
      }
      return [...prev, { subjectId, classTime: time, selfStudyTime: 0 }];
    });
  };

  const handleSubjectSelfStudyTimeChange = (subjectId: string, time: number) => {
    setSubjectTimes(prev => {
      const existing = prev.find(st => st.subjectId === subjectId);
      if (existing) {
        return prev.map(st =>
          st.subjectId === subjectId ? { ...st, selfStudyTime: time } : st
        );
      }
      return [...prev, { subjectId, classTime: 0, selfStudyTime: time }];
    });
  };

  const handleAdminEffortManualChange = (time: number) => {
    if (isWeekly) {
      setAdminEffort(Math.min(time, weeklyWorkloadTotal));
      return;
    }

    setAdminEffort(time);
    setAdminEffortSliderMax(Math.max(DEFAULT_TIME_SLIDER_MAX, time));
  };

  const handleCommuteTimeManualChange = (time: number) => {
    setCommuteTime(time);
    setCommuteTimeSliderMax(Math.max(DEFAULT_TIME_SLIDER_MAX, time));
  };

  const handleStructuralChangesManualChange = (time: number) => {
    setStructuralChanges(Math.min(time, weeklyWorkloadTotal));
  };

  const handleSkipDay = async () => {
    setSaveError(null);
    setIsSaving(true);
    const entry: DailyEntry = {
      date: format(date, 'yyyy-MM-dd'),
      courses: [],
      subjectTimes: [],
      reliability: 0,
      adminEffort: 0,
      commuteTime: 0,
      structuralChanges: 0,
      comment: t('dailyEntry.skippedTag'),
      skipped: true
    };
    try {
      await onSave(entry);
      setIsSubmitted(true);
    } catch (error) {
      setSaveError(t('dailyEntry.saveFailed'));
      console.error('Failed to save skipped day:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const weeklyWorkloadTotal = subjectTimes.reduce((sum, { classTime }) => sum + Math.max(0, classTime || 0), 0);
  const adminEffortMax = isWeekly ? weeklyWorkloadTotal : adminEffortSliderMax;
  const adminEffortPercentage = weeklyWorkloadTotal > 0
    ? Math.round((adminEffort / weeklyWorkloadTotal) * 100)
    : 0;
  const structuralChangesPercentage = weeklyWorkloadTotal > 0
    ? Math.round((structuralChanges / weeklyWorkloadTotal) * 100)
    : 0;
  const shouldShowWeeklyExtraSliders = isWeekly && weeklyWorkloadTotal > 0;
  const shouldShowAdminEffort = !isWeekly || shouldShowWeeklyExtraSliders;

  useEffect(() => {
    if (isWeekly && adminEffort > weeklyWorkloadTotal) {
      setAdminEffort(weeklyWorkloadTotal);
    }
    if (isWeekly && structuralChanges > weeklyWorkloadTotal) {
      setStructuralChanges(weeklyWorkloadTotal);
    }
  }, [adminEffort, isWeekly, structuralChanges, weeklyWorkloadTotal]);

  const hasEnteredSubjectTime = subjectTimes.some(
    ({ classTime, selfStudyTime }) => classTime > 0 || selfStudyTime > 0
  );
  const hasChangedReliability = reliability !== (existingEntry?.reliability ?? 0);
  const hasChangedAdminEffort = adminEffort !== (isWeekly ? 0 : existingEntry?.adminEffort ?? 0);
  const hasChangedCommuteTime = !isWeekly && commuteTime !== (existingEntry?.commuteTime ?? defaultCommuteTime);
  const hasChangedStructuralChanges = isWeekly && structuralChanges > 0;
  const hasChangedComment = comment !== (existingEntry?.comment ?? '');
  const hasComment = existingEntry ? hasChangedComment : comment.trim().length > 0;
  const hasAddendumChanges =
    hasEnteredSubjectTime ||
    hasChangedReliability ||
    hasChangedAdminEffort ||
    hasChangedCommuteTime ||
    hasChangedStructuralChanges ||
    hasChangedComment;

  const shouldShowCloseWarning =
    hasEnteredSubjectTime ||
    hasChangedReliability ||
    hasChangedAdminEffort ||
    hasChangedCommuteTime ||
    hasChangedStructuralChanges ||
    hasComment;

  const handleCloseRequest = () => {
    if (shouldShowCloseWarning) {
      setShowCloseWarning(true);
      return;
    }

    onClose();
  };

  const handleSubmit = async () => {
    setSaveError(null);
    setIsSaving(true);
    const entry: DailyEntry = {
      date: format(date, 'yyyy-MM-dd'),
      courses,
      subjectTimes,
      reliability,
      adminEffort,
      commuteTime,
      structuralChanges,
      comment,
      skipped: false
    };

    try {
      await onSave(entry);
      setIsSubmitted(true);
    } catch (error) {
      setSaveError(t('dailyEntry.saveFailed'));
      console.error('Failed to save daily entry:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-xl text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">{t('dailyEntry.saved')}</h3>
          <p className="text-gray-600 mb-6">
            {t('dailyEntry.savedDescription', { date: periodLabel })}
          </p>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 transition-colors font-medium"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto pt-8">
        <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-xl my-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900">
              {reEntryMode === 'add' ? t('dailyEntry.addHours') : isWeekly ? t('weeklyEntry.title') : t('dailyEntry.title')}
            </h3>
            <p className="text-sm text-gray-500">{periodLabel}</p>
            {reEntryMode === 'add' && (
              <p className="text-xs text-amber-700 mt-1">{t('dailyEntry.addingExisting')}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSkipDay}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
            >
              {t('dailyEntry.skip')}
            </button>
            <button onClick={handleCloseRequest} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        <div className="bg-blue-50 rounded-lg p-3 mb-6">
          <p className="text-xs text-blue-800">
            💡 <strong>{t('dailyEntry.tip')}</strong>
            <p>{t('dailyEntry.tipDescription1')}</p> 
            <p>{t('dailyEntry.tipDescription2')}</p>
          </p>
        </div>

        <div className="space-y-4 mb-6">
          <h4 className="font-medium text-gray-800">{isWeekly ? t('weeklyEntry.categories') : t('dailyEntry.subjects')}</h4>

          {subjects.length === 0 ? (
            <div className="text-center py-8 bg-amber-50 rounded-xl">
              <p className="text-sm text-amber-700 mb-2">{t('courseManagement.none')}</p>
              <p className="text-xs text-amber-600">{t('dailyEntry.noSubjectsHelp')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {subjects.map(subject => {
                const subjectTime = subjectTimes.find(st => st.subjectId === subject.id);

                let classStatusTag: string | null = null;
                let studyStatusTag: string | null = null;
                let isFaded = false;
                if (reEntryMode === 'add' && existingEntry) {
                  const existingSubjectTime = existingEntry.subjectTimes?.find(st => st.subjectId === subject.id);
                  const hadClassData = !!existingSubjectTime && (
                    existingSubjectTime.hasClassEntry ||
                    existingSubjectTime.classTime > 0
                  );
                  const hadStudyData = !!existingSubjectTime && (
                    existingSubjectTime.hasStudyEntry ||
                    existingSubjectTime.selfStudyTime > 0
                  );

                  classStatusTag = hadClassData ? t('dailyEntry.filledBefore') : t('dailyEntry.skippedTag');
                  studyStatusTag = hadStudyData ? t('dailyEntry.filledBefore') : t('dailyEntry.skippedTag');
                  isFaded = true;
                }

                return (
                  <SubjectTimeInput
                    key={subject.id}
                    subjectName={getSubjectDisplayName(subject, language)}
                    subjectColor={subject.color}
                    classTime={subjectTime?.classTime || 0}
                    selfStudyTime={isWeekly ? 0 : subjectTime?.selfStudyTime || 0}
                    onClassTimeChange={(time) => handleSubjectClassTimeChange(subject.id, time)}
                    onSelfStudyTimeChange={(time) => handleSubjectSelfStudyTimeChange(subject.id, time)}
                    classStatusTag={classStatusTag}
                    studyStatusTag={isWeekly ? null : studyStatusTag}
                    isFaded={isFaded}
                    isAdditionalHours={reEntryMode === 'add'}
                    singleTimeLabel={isWeekly ? t('weeklyEntry.hours') : undefined}
                  />
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-6 mb-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                {t('dailyEntry.reliability')}
                {reEntryMode === 'add' && existingEntry && existingEntry.reliability > 0 && (
                  <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                    {t('dailyEntry.filledBefore')}
                  </span>
                )}
              </label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(rating => (
                  <button
                    key={rating}
                    onClick={() => setReliability(rating)}
                    className="transition-colors"
                  >
                    <Star
                      className={`w-5 h-5 ${
                        rating <= reliability
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-gray-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {shouldShowAdminEffort && <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                {t('dailyEntry.adminEffort')}
                {reEntryMode === 'add' && existingEntry && existingEntry.adminEffort > 0 && (
                  <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                    {t('dailyEntry.filledBefore')}
                  </span>
                )}
              </label>
              <div className="flex items-center gap-2">
                <EditableTimeDisplay
                  value={adminEffort}
                  onChange={handleAdminEffortManualChange}
                  max={isWeekly ? weeklyWorkloadTotal : DEFAULT_TIME_SLIDER_MAX}
                  clampToMax={isWeekly}
                />
                {isWeekly && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                    {adminEffortPercentage}%
                  </span>
                )}
              </div>
            </div>
            <Slider
              value={[adminEffort]}
              onValueChange={(value) => setAdminEffort(Math.min(value[0], adminEffortMax))}
              max={adminEffortMax}
              step={0.25}
              className="relative flex items-center select-none touch-none w-full h-5"
            >
              <div className="relative flex-1 h-2 bg-gray-200 rounded-full">
                <div
                  className="absolute h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${adminEffortMax > 0 ? (adminEffort / adminEffortMax) * 100 : 0}%` }}
                />
              </div>
              <div
                className="block w-5 h-5 bg-white border-2 border-indigo-500 rounded-full shadow-lg hover:scale-110 transition-transform cursor-pointer"
                style={{ position: 'absolute', left: `calc(${adminEffortMax > 0 ? (adminEffort / adminEffortMax) * 100 : 0}% - 10px)` }}
              />
            </Slider>
          </div>}

          {!isWeekly && <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <span className="flex items-center gap-1 text-gray-500">
                  <Bike className="w-4 h-4" />
                  <TrainFront className="w-4 h-4" />
                </span>
                {t('dailyEntry.commute')}
                {reEntryMode === 'add' && existingEntry && existingEntry.commuteTime > 0 && (
                  <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                    {t('dailyEntry.filledBefore')}
                  </span>
                )}
              </label>
              <EditableTimeDisplay
                value={commuteTime}
                onChange={handleCommuteTimeManualChange}
                max={DEFAULT_TIME_SLIDER_MAX}
                clampToMax={false}
              />
            </div>
            <Slider
              value={[commuteTime]}
              onValueChange={(value) => setCommuteTime(value[0])}
              max={commuteTimeSliderMax}
              step={0.25}
              className="relative flex items-center select-none touch-none w-full h-5"
            >
              <div className="relative flex-1 h-2 bg-gray-200 rounded-full">
                <div
                  className="absolute h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${(commuteTime / commuteTimeSliderMax) * 100}%` }}
                />
              </div>
              <div
                className="block w-5 h-5 bg-white border-2 border-indigo-500 rounded-full shadow-lg hover:scale-110 transition-transform cursor-pointer"
                style={{ position: 'absolute', left: `calc(${(commuteTime / commuteTimeSliderMax) * 100}% - 10px)` }}
              />
            </Slider>
          </div>}

          {shouldShowWeeklyExtraSliders && <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                {t('weeklyEntry.structuralChanges')}
              </label>
              <div className="flex items-center gap-2">
                <EditableTimeDisplay
                  value={structuralChanges}
                  onChange={handleStructuralChangesManualChange}
                  max={weeklyWorkloadTotal}
                  clampToMax
                />
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                  {structuralChangesPercentage}%
                </span>
              </div>
            </div>
            <Slider
              value={[structuralChanges]}
              onValueChange={(value) => setStructuralChanges(Math.min(value[0], weeklyWorkloadTotal))}
              max={weeklyWorkloadTotal}
              step={0.25}
              className="relative flex items-center select-none touch-none w-full h-5"
            >
              <div className="relative flex-1 h-2 bg-gray-200 rounded-full">
                <div
                  className="absolute h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${weeklyWorkloadTotal > 0 ? (structuralChanges / weeklyWorkloadTotal) * 100 : 0}%` }}
                />
              </div>
              <div
                className="block w-5 h-5 bg-white border-2 border-indigo-500 rounded-full shadow-lg hover:scale-110 transition-transform cursor-pointer"
                style={{ position: 'absolute', left: `calc(${weeklyWorkloadTotal > 0 ? (structuralChanges / weeklyWorkloadTotal) * 100 : 0}% - 10px)` }}
              />
            </Slider>
          </div>}

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-500" />
              {t('dailyEntry.comment')}
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              placeholder={t('dailyEntry.commentPlaceholder')}
            />
          </div>
        </div>

        <div className="flex gap-3">
          {saveError && (
            <p className="text-sm text-red-600">{saveError}</p>
          )}
          <button
            onClick={handleSubmit}
            disabled={isSaving || (isAddMode && !hasAddendumChanges)}
            className="flex-1 px-4 py-3 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {isSaving ? `${t('dailyEntry.submit')}...` : t('dailyEntry.submit')}
          </button>
        </div>
        </div>
      </div>
      <ConfirmDialog
        open={showCloseWarning}
        title={t('dailyEntry.closeTitle')}
        description={t('dailyEntry.closeConfirm')}
        confirmLabel={t('common.discard')}
        cancelLabel={t('common.continueEditing')}
        onCancel={() => setShowCloseWarning(false)}
        onConfirm={() => {
          setShowCloseWarning(false);
          onClose();
        }}
      />
    </>
  );
}

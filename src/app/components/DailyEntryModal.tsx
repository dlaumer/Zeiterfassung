import { FieldHelp } from './FieldHelp';
import { X, Trash2, Star, Bike, TrainFront, FileText, CheckCircle, History, FileCheck2, Pencil, Clock3 } from 'lucide-react';
import { format, endOfWeek } from 'date-fns';
import { useState, useEffect, useRef } from 'react';
import { SocialBatteryInput } from './SocialBatteryInput';
import { SubjectTimeInput } from './SubjectTimeInput';
import { Slider } from '@radix-ui/react-slider';
import { useI18n } from '../i18n/i18n';
import { getDateLocale } from '../i18n/dateLocale';
import { Subject, getSubjectDisplayName } from './CourseManagement';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { EditableTimeDisplay } from './EditableTimeDisplay';
import categoryGuideUrl from '../../assets/KategorisierungZeiterfassung.pdf';

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
  socialBattery?: number;
  adminEffort: number;
  commuteTime: number;
  structuralChanges?: number;
  comment: string;
  skipped: boolean;
  initialSubmittedAt?: string;
  correctionDates?: string[];
}

interface DailyEntryModalProps {
  date: Date;
  onClose: () => void;
  onDelete: () => Promise<void>;
  readOnly: boolean;
  reviewTime: number;
  onSave: (entry: DailyEntry) => Promise<void>;
  existingEntry: DailyEntry | null;
  availableCourses: string[];
  subjects: Subject[];
  defaultCommuteTime?: number;
  entryMode?: 'day' | 'week';
  participantRole?: 'student' | 'faculty';
  participantSubjectLabel?: string;
}

const DEFAULT_TIME_SLIDER_MAX = 5;
const WEEKLY_TIME_SLIDER_MAX = 41;

interface EditablePercentageDisplayProps {
  value: number;
  onChange: (value: number) => void;
}

function EditablePercentageDisplay({ value, onChange }: EditablePercentageDisplayProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) {
      setEditValue(String(value));
    }
  }, [isEditing, value]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const commitEdit = () => {
    const nextValue = Number(editValue);

    if (Number.isFinite(nextValue) && nextValue >= 0 && nextValue <= 100) {
      onChange(nextValue);
    }

    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min="0"
        max="100"
        step="1"
        value={editValue}
        onChange={(event) => setEditValue(event.target.value)}
        onBlur={commitEdit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commitEdit();
          }
          if (event.key === 'Escape') {
            setIsEditing(false);
          }
        }}
        className="w-14 rounded-full border border-indigo-300 bg-white px-2 py-0.5 text-right text-xs font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500"
        aria-label="Percentage"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setEditValue(String(value));
        setIsEditing(true);
      }}
      className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
    >
      {value}%
    </button>
  );
}

export function DailyEntryModal({ date, onClose, onSave, onDelete, readOnly, reviewTime, existingEntry, subjects, defaultCommuteTime = 0, entryMode = 'day', participantRole = 'student', participantSubjectLabel }: DailyEntryModalProps) {
  const { t, language } = useI18n();
  const [courses, setCourses] = useState<Course[]>([]);
  const [subjectTimes, setSubjectTimes] = useState<SubjectTime[]>([]);
  const [reliability, setReliability] = useState(0);
  const [socialBattery, setSocialBattery] = useState(0);
  const [adminEffort, setAdminEffort] = useState(0);
  const [commuteTime, setCommuteTime] = useState(0);
  const [structuralChanges, setStructuralChanges] = useState(0);
  const [adminEffortSliderMax, setAdminEffortSliderMax] = useState(DEFAULT_TIME_SLIDER_MAX);
  const [commuteTimeSliderMax, setCommuteTimeSliderMax] = useState(DEFAULT_TIME_SLIDER_MAX);
  const [comment, setComment] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showReliabilityError, setShowReliabilityError] = useState(false);
  const [showSocialBatteryError, setShowSocialBatteryError] = useState(false);
  const [showCloseWarning, setShowCloseWarning] = useState(false);
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const isWeekly = entryMode === 'week';
  const isFaculty = participantRole === 'faculty';
  const isCorrection = !!existingEntry && !readOnly;
  const categoriesTitle = isFaculty && participantSubjectLabel
    ? participantSubjectLabel
    : ""
  const dateLocale = getDateLocale(language);
  const periodEnd = endOfWeek(date, { weekStartsOn: 1 });
  const periodLabel = isWeekly
    ? `${format(date, 'MMMM d, yyyy', { locale: dateLocale })} - ${format(periodEnd, 'MMMM d, yyyy', { locale: dateLocale })}`
    : format(date, 'EEEE, MMMM d, yyyy', { locale: dateLocale });

  useEffect(() => {
    setCourses(existingEntry?.courses ?? []);
    setSubjectTimes(subjects.map(s => existingEntry?.subjectTimes.find(st => st.subjectId === s.id) ?? { subjectId: s.id, classTime: 0, selfStudyTime: 0 }));
    setReliability(readOnly ? existingEntry?.reliability ?? 0 : 0);
    setSocialBattery(readOnly ? existingEntry?.socialBattery ?? 0 : 0);
    const nextAdminEffort = existingEntry?.adminEffort ?? 0;
    const nextCommuteTime = isFaculty ? 0 : existingEntry?.commuteTime ?? defaultCommuteTime;
    setAdminEffort(nextAdminEffort);
    setCommuteTime(nextCommuteTime);
    setStructuralChanges(existingEntry?.structuralChanges ?? 0);
    setAdminEffortSliderMax(Math.max(DEFAULT_TIME_SLIDER_MAX, nextAdminEffort));
    setCommuteTimeSliderMax(Math.max(DEFAULT_TIME_SLIDER_MAX, nextCommuteTime));
    setComment(readOnly ? existingEntry?.comment ?? '' : '');
    setShowReliabilityError(false);
    setShowSocialBatteryError(false);
    setSaveError(null);
  }, [existingEntry, subjects.map(s => s.id).join(','), defaultCommuteTime, isFaculty, readOnly]);

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
    if (isFaculty) {
      setAdminEffort(Math.min(time, facultyWorkloadTotal));
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
    setStructuralChanges(Math.min(time, facultyWorkloadTotal));
  };

  const handleAdminEffortPercentageChange = (percentage: number) => {
    setAdminEffort((facultyWorkloadTotal * percentage) / 100);
  };

  const handleStructuralChangesPercentageChange = (percentage: number) => {
    setStructuralChanges((facultyWorkloadTotal * percentage) / 100);
  };

  const handleSkipDay = async () => {
    setSaveError(null);
    setShowSocialBatteryError(socialBattery <= 0);
    if (socialBattery <= 0) {
      setSaveError(t('dailyEntry.socialBatteryRequired'));
      return;
    }
    setIsSaving(true);
    const entry: DailyEntry = {
      date: format(date, 'yyyy-MM-dd'),
      courses: [],
      subjectTimes: [],
      reliability: 5,
      socialBattery: socialBattery || undefined,
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

  const facultyWorkloadTotal = subjectTimes.reduce((sum, { classTime }) => sum + Math.max(0, classTime || 0), 0);
  const adminEffortMax = isFaculty ? facultyWorkloadTotal : adminEffortSliderMax;
  const adminEffortPercentage = facultyWorkloadTotal > 0
    ? Math.round((adminEffort / facultyWorkloadTotal) * 100)
    : 0;
  const structuralChangesPercentage = facultyWorkloadTotal > 0
    ? Math.round((structuralChanges / facultyWorkloadTotal) * 100)
    : 0;
  const shouldShowFacultyExtraSliders = isFaculty && facultyWorkloadTotal > 0;
  const shouldShowAdminEffort = !isFaculty || shouldShowFacultyExtraSliders;

  useEffect(() => {
    if (isFaculty && adminEffort > facultyWorkloadTotal) {
      setAdminEffort(facultyWorkloadTotal);
    }
    if (isFaculty && structuralChanges > facultyWorkloadTotal) {
      setStructuralChanges(facultyWorkloadTotal);
    }
  }, [adminEffort, isFaculty, structuralChanges, facultyWorkloadTotal]);

  const hasEnteredSubjectTime = subjectTimes.some(
    ({ classTime, selfStudyTime }) => classTime > 0 || selfStudyTime > 0
  );
  const hasEnteredCourseLikeWorkload =
    courses.some((course) => course.hours > 0) ||
    hasEnteredSubjectTime;
  const shouldShowCloseWarning = !readOnly && (
    subjectTimes.some(st => {
      const old = existingEntry?.subjectTimes.find(item => item.subjectId === st.subjectId);
      return st.classTime !== (old?.classTime ?? 0) || st.selfStudyTime !== (old?.selfStudyTime ?? 0);
    }) || reliability !== 0 ||
    socialBattery !== 0 ||
    adminEffort !== (existingEntry?.adminEffort ?? 0) ||
    commuteTime !== (existingEntry?.commuteTime ?? defaultCommuteTime) ||
    structuralChanges !== (existingEntry?.structuralChanges ?? 0) || comment !== ''
  );

  const handleCloseRequest = () => {
    if (shouldShowCloseWarning) {
      setShowCloseWarning(true);
      return;
    }

    onClose();
  };

  const handleSubmit = async () => {
    if (readOnly || isSaving) return;
    setSaveError(null);
    setShowReliabilityError(reliability <= 0);
    setShowSocialBatteryError(socialBattery <= 0);

    if (reliability <= 0 || socialBattery <= 0) {
      return;
    }

    const submittedComment = !existingEntry && !hasEnteredCourseLikeWorkload && comment.trim().length === 0
      ? t('dailyEntry.skippedTag')
      : comment;

    setIsSaving(true);
    const entry: DailyEntry = {
      date: format(date, 'yyyy-MM-dd'),
      courses,
      subjectTimes,
      reliability,
      socialBattery: socialBattery || undefined,
      adminEffort,
      commuteTime,
      structuralChanges,
      comment: submittedComment,
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
              {existingEntry ? t('dailyEntry.reviewTitle') : isWeekly ? t('weeklyEntry.title') : t('dailyEntry.title')}
            </h3>
            <p className="text-sm text-gray-500">{periodLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            {!existingEntry && <button
              disabled={isSaving}
              onClick={handleSkipDay}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
            >
              {t('dailyEntry.skip')}
            </button>}
            <button onClick={handleCloseRequest} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {existingEntry && <section className="mb-5 overflow-hidden rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 to-white" aria-label={t('dailyEntry.submissionHistory')}>
          <div className="flex items-center gap-2 border-b border-indigo-100/70 px-4 py-3">
            <History aria-hidden="true" className="h-4 w-4 text-indigo-500" />
            <h4 className="text-sm font-semibold text-indigo-950">{t('dailyEntry.submissionHistory')}</h4>
          </div>
          <ol className="max-h-48 overflow-y-auto px-4 py-2">
            {[
              ...(existingEntry.initialSubmittedAt ? [{ value: existingEntry.initialSubmittedAt, label: t('dailyEntry.initialSubmission'), initial: true }] : []),
              ...[...(existingEntry.correctionDates ?? [])].sort().map((value, index) => ({ value, label: t('dailyEntry.correctionNumber', { number: index + 1 }), initial: false })),
            ].map(({ value, label, initial }, index, history) => {
              const Icon = initial ? FileCheck2 : Pencil;
              return <li key={`${value}-${index}`} className="relative flex items-start gap-3 py-2">
                {index < history.length - 1 && <span aria-hidden="true" className="absolute bottom-[-0.5rem] left-3.5 top-9 w-px bg-indigo-100" />}
                <span className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${initial ? 'bg-indigo-100 text-indigo-600' : 'border border-indigo-100 bg-white text-slate-500'}`}>
                  <Icon aria-hidden="true" className="h-3.5 w-3.5" />
                </span>
                <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-1">
                  <span className="text-sm font-medium text-slate-700">{label}</span>
                  <time dateTime={new Date(value.replace(' ', 'T')).toISOString()} className="flex items-center gap-1.5 text-xs tabular-nums text-slate-500">
                    <Clock3 aria-hidden="true" className="h-3 w-3" />
                    {format(new Date(value.replace(' ', 'T')), 'dd.MM.yyyy HH:mm', { locale: dateLocale })}
                  </time>
                </div>
              </li>;
            })}
          </ol>
        </section>}
        {readOnly && <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{t('dailyEntry.reviewExpired', { days: reviewTime })}</p>}
        <fieldset
          disabled={readOnly || isSaving}
          onClickCapture={event => { if (readOnly || isSaving) event.stopPropagation(); }}
          onPointerDownCapture={event => { if (readOnly || isSaving) event.stopPropagation(); }}
          className="min-w-0"
        >
        {!readOnly && <div className="bg-blue-50 rounded-lg p-3 mb-6">
          <div className="text-xs text-blue-800">
            💡 <strong>{t('dailyEntry.tip')}</strong>
            <p>{t('dailyEntry.tipDescription1')}</p> 
            <p>{t('dailyEntry.tipDescription2')}</p>
            {isFaculty && (
              <p>
                <a
                  href={categoryGuideUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-blue-900 underline underline-offset-2 hover:text-blue-700"
                >
                  {t('weeklyEntry.categoryGuide')}
                </a>
              </p>
            )}
          </div>
        </div>}

        <div className="space-y-4 mb-6">
          <h4 className="font-medium text-gray-800">{isFaculty ? categoriesTitle : t('dailyEntry.subjects')}</h4>

          {subjects.length === 0 ? (
            <div className="text-center py-8 bg-amber-50 rounded-xl">
              <p className="text-sm text-amber-700 mb-2">{t('courseManagement.none')}</p>
              <p className="text-xs text-amber-600">{t('dailyEntry.noSubjectsHelp')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {subjects.map(subject => {
                const subjectTime = subjectTimes.find(st => st.subjectId === subject.id);

                return (
                  <SubjectTimeInput
                    key={subject.id}
                    subjectName={getSubjectDisplayName(subject, language)}
                    subjectColor={subject.color}
                    classTime={subjectTime?.classTime || 0}
                    previousClassTime={isCorrection ? existingEntry.subjectTimes.find(st => st.subjectId === subject.id)?.classTime ?? 0 : undefined}
                    previousSelfStudyTime={isCorrection ? existingEntry.subjectTimes.find(st => st.subjectId === subject.id)?.selfStudyTime ?? 0 : undefined}
                    selfStudyTime={isFaculty ? 0 : subjectTime?.selfStudyTime || 0}
                    onClassTimeChange={(time) => handleSubjectClassTimeChange(subject.id, time)}
                    onSelfStudyTimeChange={(time) => handleSubjectSelfStudyTimeChange(subject.id, time)}
                    singleTimeLabel={isFaculty ? t('weeklyEntry.hours') : undefined}
                    timeSliderMax={Math.max(isWeekly ? WEEKLY_TIME_SLIDER_MAX : 8, subjectTime?.classTime ?? 0, subjectTime?.selfStudyTime ?? 0)}
                  />
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-6 mb-6">
          {shouldShowFacultyExtraSliders && (
            <div className="space-y-1 bg-blue-50 rounded-lg p-3 text-xs text-blue-800">
              <p>{t('weeklyEntry.facultyAllocationInfo')}</p>
              <p className="italic">{t('weeklyEntry.facultyAllocationNote')}</p>
            </div>
          )}

          {shouldShowAdminEffort && <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                {t('dailyEntry.adminEffort')}
              </label>
              <div className="flex items-center gap-2">
                <EditableTimeDisplay
                  value={adminEffort}
                  previousValue={isCorrection ? existingEntry.adminEffort : undefined}
                  onChange={handleAdminEffortManualChange}
                  max={isFaculty ? facultyWorkloadTotal : DEFAULT_TIME_SLIDER_MAX}
                  clampToMax={isFaculty}
                />
                {isFaculty && (
                  <EditablePercentageDisplay
                    value={adminEffortPercentage}
                    onChange={handleAdminEffortPercentageChange}
                  />
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

          {!isFaculty && <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <span className="flex items-center gap-1 text-gray-500">
                  <Bike className="w-4 h-4" />
                  <TrainFront className="w-4 h-4" />
                </span>
                {t('dailyEntry.commute')}
              </label>
              <EditableTimeDisplay
                value={commuteTime}
                previousValue={isCorrection ? existingEntry.commuteTime : undefined}
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

          {shouldShowFacultyExtraSliders && <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                {t('weeklyEntry.structuralChanges')}
              </label>
              <div className="flex items-center gap-2">
                <EditableTimeDisplay
                  value={structuralChanges}
                  previousValue={isCorrection ? existingEntry.structuralChanges ?? 0 : undefined}
                  onChange={handleStructuralChangesManualChange}
                  max={facultyWorkloadTotal}
                  clampToMax
                />
                <EditablePercentageDisplay
                  value={structuralChangesPercentage}
                  onChange={handleStructuralChangesPercentageChange}
                />
              </div>
            </div>
            <Slider
              value={[structuralChanges]}
              onValueChange={(value) => setStructuralChanges(Math.min(value[0], facultyWorkloadTotal))}
              max={facultyWorkloadTotal}
              step={0.25}
              className="relative flex items-center select-none touch-none w-full h-5"
            >
              <div className="relative flex-1 h-2 bg-gray-200 rounded-full">
                <div
                  className="absolute h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${facultyWorkloadTotal > 0 ? (structuralChanges / facultyWorkloadTotal) * 100 : 0}%` }}
                />
              </div>
              <div
                className="block w-5 h-5 bg-white border-2 border-indigo-500 rounded-full shadow-lg hover:scale-110 transition-transform cursor-pointer"
                style={{ position: 'absolute', left: `calc(${facultyWorkloadTotal > 0 ? (structuralChanges / facultyWorkloadTotal) * 100 : 0}% - 10px)` }}
              />
            </Slider>
          </div>}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-gray-700 flex items-center gap-2">
                {t('dailyEntry.reliability')}
                <FieldHelp title={t('dailyEntry.reliability')} text={t(`fieldHelp.reliability.${participantRole}`)} />
              </div>
              <div className="flex shrink-0 gap-1">
                {[1, 2, 3, 4, 5].map(rating => (
                  <button
                    key={rating}
                    type="button"
                    aria-label={`${t('dailyEntry.reliability')}: ${rating}/5`}
                    onClick={() => {
                      setReliability(rating);
                      setShowReliabilityError(false);
                      setSaveError(null);
                    }}
                    className="rounded-sm p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    <Star
                      className={`w-6 h-6 ${
                        rating <= reliability
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-gray-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
            {showReliabilityError && (
              <p role="alert" className="text-sm font-medium text-red-600">
                {t('dailyEntry.reliabilityRequired')}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <SocialBatteryInput
              value={socialBattery}
              onChange={(value) => {
                setSocialBattery(value);
                setShowSocialBatteryError(false);
                setSaveError(null);
              }}
              participantRole={participantRole}
            />
            {showSocialBatteryError && (
              <p role="alert" className="text-sm font-medium text-red-600">
                {t('dailyEntry.socialBatteryRequired')}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-500" />
              <label htmlFor="submission-comment">{t('dailyEntry.comment')}</label>
              <FieldHelp title={t('dailyEntry.comment')} text={t(`dailyEntry.commentPlaceholder.${participantRole}`)} />
            </div>
            <textarea
              id="submission-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              placeholder={t(`dailyEntry.commentPlaceholder.${participantRole}`)}
            />
          </div>
        </div>

        </fieldset>
        <div className="flex gap-3">
          {saveError && (
            <p className="text-sm text-red-600">{saveError}</p>
          )}
          {existingEntry && !readOnly && <button disabled={isSaving} onClick={() => setShowDeleteWarning(true)} className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-3 font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"><Trash2 className="h-4 w-4" />{t('dailyEntry.delete')}</button>}
          {!readOnly && <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="flex-1 px-4 py-3 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {isSaving ? `${t('dailyEntry.submit')}...` : existingEntry ? t('dailyEntry.saveCorrection') : t('dailyEntry.submit')}
          </button>}
        </div>
        </div>
      </div>
      <ConfirmDialog
        open={showDeleteWarning}
        title={t('dailyEntry.delete')}
        description={t('dailyEntry.deleteConfirm')}
        confirmLabel={t('dailyEntry.delete')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onCancel={() => setShowDeleteWarning(false)}
        onConfirm={async () => {
          if (readOnly || isSaving) return;
          setIsSaving(true);
          try { await onDelete(); } catch (error) { setSaveError(t('dailyEntry.saveFailed')); }
          finally { setIsSaving(false); setShowDeleteWarning(false); }
        }}
      />
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

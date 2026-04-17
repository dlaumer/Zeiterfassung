import { X, Star, Car, FileText, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useState, useEffect } from 'react';
import { SubjectTimeInput } from './SubjectTimeInput';
import { Slider } from '@radix-ui/react-slider';
import { useI18n } from '../i18n/i18n';

interface Subject {
  id: string;
  name: string;
  color: string;
}

interface SubjectTime {
  subjectId: string;
  classTime: number;
  selfStudyTime: number;
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
  comment: string;
  skipped: boolean;
}

interface DailyEntryModalProps {
  date: Date;
  onClose: () => void;
  onSave: (entry: DailyEntry) => void;
  existingEntry: DailyEntry | null;
  availableCourses: string[];
  subjects: Subject[];
  defaultCommuteTime?: number;
}

export function DailyEntryModal({ date, onClose, onSave, existingEntry, subjects, defaultCommuteTime = 0 }: DailyEntryModalProps) {
  const { t } = useI18n();
  const [courses, setCourses] = useState<Course[]>([]);
  const [subjectTimes, setSubjectTimes] = useState<SubjectTime[]>([]);
  const [reliability, setReliability] = useState(3);
  const [adminEffort, setAdminEffort] = useState(0);
  const [commuteTime, setCommuteTime] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const reEntryMode = existingEntry ? 'add' : null;

  useEffect(() => {
    setCourses([]);
    setSubjectTimes(subjects.map(s => ({ subjectId: s.id, classTime: 0, selfStudyTime: 0 })));
    setReliability(3);
    setAdminEffort(0);
    setCommuteTime(defaultCommuteTime);
    setComment('');
  }, [existingEntry, subjects, defaultCommuteTime]);

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

  const handleSkipDay = () => {
    const entry: DailyEntry = {
      date: format(date, 'yyyy-MM-dd'),
      courses: [],
      subjectTimes: [],
      reliability: 0,
      adminEffort: 0,
      commuteTime: 0,
      comment: t('dailyEntry.skippedTag'),
      skipped: true
    };
    onSave(entry);
    setIsSubmitted(true);
  };

  const handleSubmit = () => {
    const entry: DailyEntry = {
      date: format(date, 'yyyy-MM-dd'),
      courses,
      subjectTimes,
      reliability,
      adminEffort,
      commuteTime,
      comment,
      skipped: false
    };

    if (reEntryMode === 'add' && existingEntry) {
      const mergedCourses = [...existingEntry.courses];
      courses.forEach(newCourse => {
        const existingCourseIndex = mergedCourses.findIndex(c => c.name === newCourse.name);
        if (existingCourseIndex >= 0) {
          mergedCourses[existingCourseIndex].hours += newCourse.hours;
        } else {
          mergedCourses.push(newCourse);
        }
      });
      entry.courses = mergedCourses;

      const mergedSubjectTimes = [...(existingEntry.subjectTimes || [])];
      subjectTimes.forEach(newST => {
        const existingSTIndex = mergedSubjectTimes.findIndex(st => st.subjectId === newST.subjectId);
        if (existingSTIndex >= 0) {
          mergedSubjectTimes[existingSTIndex].classTime += newST.classTime;
          mergedSubjectTimes[existingSTIndex].selfStudyTime += newST.selfStudyTime;
        } else {
          mergedSubjectTimes.push(newST);
        }
      });
      entry.subjectTimes = mergedSubjectTimes;
    }

    onSave(entry);
    setIsSubmitted(true);
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
            {t('dailyEntry.savedDescription', { date: format(date, 'MMMM d, yyyy') })}
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
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto pt-8">
      <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-xl my-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900">
              {reEntryMode === 'add' ? t('dailyEntry.addHours') : t('dailyEntry.title')}
            </h3>
            <p className="text-sm text-gray-500">{format(date, 'EEEE, MMMM d, yyyy')}</p>
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
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        <div className="bg-blue-50 rounded-lg p-3 mb-6">
          <p className="text-xs text-blue-800">
            💡 <strong>{t('dailyEntry.tip')}</strong> {t('dailyEntry.tipDescription')}
          </p>
        </div>

        <div className="space-y-4 mb-6">
          <h4 className="font-medium text-gray-800">{t('dailyEntry.subjects')}</h4>

          {subjects.length === 0 ? (
            <div className="text-center py-8 bg-amber-50 rounded-xl">
              <p className="text-sm text-amber-700 mb-2">{t('courseManagement.none')}</p>
              <p className="text-xs text-amber-600">{t('dailyEntry.noSubjectsHelp')}</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {subjects.map(subject => {
                const subjectTime = subjectTimes.find(st => st.subjectId === subject.id);

                let statusTag = null;
                let isFaded = false;
                if (reEntryMode === 'add' && existingEntry) {
                  const existingSubjectTime = existingEntry.subjectTimes?.find(st => st.subjectId === subject.id);
                  const hadData = existingSubjectTime && (existingSubjectTime.classTime > 0 || existingSubjectTime.selfStudyTime > 0);

                  statusTag = hadData ? t('dailyEntry.filledBefore') : t('dailyEntry.skippedTag');
                  isFaded = true;
                }

                return (
                  <SubjectTimeInput
                    key={subject.id}
                    subjectName={subject.name}
                    subjectColor={subject.color}
                    classTime={subjectTime?.classTime || 0}
                    selfStudyTime={subjectTime?.selfStudyTime || 0}
                    onClassTimeChange={(time) => handleSubjectClassTimeChange(subject.id, time)}
                    onSelfStudyTimeChange={(time) => handleSubjectSelfStudyTimeChange(subject.id, time)}
                    statusTag={statusTag}
                    isFaded={isFaded}
                    isAdditionalHours={reEntryMode === 'add'}
                  />
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-6 mb-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">{t('dailyEntry.reliability')}</label>
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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">{t('dailyEntry.adminEffort')}</label>
              <span className="text-sm font-semibold text-gray-900">{adminEffort.toFixed(1)}h</span>
            </div>
            <Slider
              value={[adminEffort]}
              onValueChange={(value) => setAdminEffort(value[0])}
              max={5}
              step={0.25}
              className="relative flex items-center select-none touch-none w-full h-5"
            >
              <div className="relative flex-1 h-2 bg-gray-200 rounded-full">
                <div
                  className="absolute h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${(adminEffort / 5) * 100}%` }}
                />
              </div>
              <div
                className="block w-5 h-5 bg-white border-2 border-indigo-500 rounded-full shadow-lg hover:scale-110 transition-transform cursor-pointer"
                style={{ position: 'absolute', left: `calc(${(adminEffort / 5) * 100}% - 10px)` }}
              />
            </Slider>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Car className="w-4 h-4 text-gray-500" />
                {t('dailyEntry.commute')}
              </label>
              <span className="text-sm font-semibold text-gray-900">{commuteTime.toFixed(1)}h</span>
            </div>
            <Slider
              value={[commuteTime]}
              onValueChange={(value) => setCommuteTime(value[0])}
              max={5}
              step={0.25}
              className="relative flex items-center select-none touch-none w-full h-5"
            >
              <div className="relative flex-1 h-2 bg-gray-200 rounded-full">
                <div
                  className="absolute h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${(commuteTime / 5) * 100}%` }}
                />
              </div>
              <div
                className="block w-5 h-5 bg-white border-2 border-indigo-500 rounded-full shadow-lg hover:scale-110 transition-transform cursor-pointer"
                style={{ position: 'absolute', left: `calc(${(commuteTime / 5) * 100}% - 10px)` }}
              />
            </Slider>
          </div>

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
          <button
            onClick={handleSubmit}
            className="flex-1 px-4 py-3 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 transition-colors font-medium"
          >
            {t('dailyEntry.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}

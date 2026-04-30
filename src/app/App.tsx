import { useState, useEffect } from 'react';
import { Calendar } from './components/Calendar';
import { DailyEntryModal } from './components/DailyEntryModal';
import { ViewEntryModal } from './components/ViewEntryModal';
import { CourseManagement, Subject, getSubjectDisplayName } from './components/CourseManagement';
import { format } from 'date-fns';
import { I18nProvider, useI18n } from './i18n/i18n';
import { LanguageSelector } from './i18n/LanguageSelector';
import PocketBase from 'pocketbase';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import logoMethric from '../assets/logoMethric.png';

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

interface SaveDailyEntryPayload {
  participantId: string;
  date: string;
  reliability: number;
  adminEffortMinutes: number;
  commuteMinutes: number;
  comment: string;
  subjectTimes: {
    subjectId: string;
    classMinutes: number;
    studyMinutes: number;
  }[];
}

interface SaveWeeklyEntryPayload {
  participantId: string;
  weekStart: string;
  reliability: number;
  adminEffortMinutes: number;
  commuteMinutes: number;
  structuralChangesMinutes: number;
  comment: string;
  categoryTimes: {
    categoryId: string;
    minutes: number;
  }[];
}

interface WorkloadStatusSubject {
  id: string;
  key: string;
  labelEn: string;
  labelDe: string;
  classTime: number;
  selfStudyTime: number;
  hasClassEntry?: boolean;
  hasStudyEntry?: boolean;
}

interface WorkloadStatusHistoryEntry {
  periodType: 'day' | 'week' | string;
  periodDate: string;
  commuteTime?: number;
  structuralChanges?: number;
  generalAdminTime?: number;
  dataRating?: number;
  comment?: string;
  comments?: string[];
  subjects: WorkloadStatusSubject[];
}

interface WorkloadStatusResponse {
  participant?: {
    id: string;
    entryMode: 'day' | 'week' | string;
  };
  submissionHistory: WorkloadStatusHistoryEntry[];
  missingPeriods?: {
    periodType: 'day' | 'week' | string;
    periodStart: string;
    periodEnd: string;
  }[];
}

const SUBMISSION_TRACKING_START_DATE = '2026-04-01';

const WEEKLY_CATEGORIES: Subject[] = [
  {
    id: 'weekly_preparation',
    key: 'weekly_preparation',
    labelEn: 'Preparation',
    labelDe: 'Vorbereitung',
    credits: 0,
    color: '#2563eb',
  },
  {
    id: 'weekly_contact_time',
    key: 'weekly_contact_time',
    labelEn: 'Contact time',
    labelDe: 'Kontaktzeit',
    credits: 0,
    color: '#16a34a',
  },
  {
    id: 'weekly_follow_up',
    key: 'weekly_follow_up',
    labelEn: 'Follow-up',
    labelDe: 'Nachbereitung',
    credits: 0,
    color: '#f97316',
  },
];

function getNewestComment(historyEntry: WorkloadStatusHistoryEntry): string {
  const comments = historyEntry.comments ?? [];
  const newestAppendum = comments
    .map((comment) => String(comment ?? '').trim())
    .filter(Boolean)
    .at(0);

  if (newestAppendum) {
    return newestAppendum;
  }

  return String(historyEntry.comment ?? '').trim();
}

const SUBJECT_COLORS = [
  '#e6194b',
  '#3cb44b',
  '#ffe119',
  '#4363d8',
  '#f58231',
  '#911eb4',
  '#46f0f0',
  '#f032e6',
  '#bcf60c',
  '#fabebe',
  '#008080',
  '#e6beff',
  '#9a6324',
  '#fffac8',
  '#800000',
  '#aaffc3',
  '#808000',
  '#ffd8b1',
  '#000075',
  '#808080',
];

const normalizeColor = (color?: string) => color?.trim().toLowerCase() ?? '';

const getNextSubjectColor = (usedColors: string[]) => {
  const usedColorSet = new Set(usedColors.map(normalizeColor));

  return SUBJECT_COLORS.find((color) => !usedColorSet.has(normalizeColor(color))) ?? SUBJECT_COLORS[0];
};

const ensureUniqueSubjectColors = <T extends { color?: string }>(subjects: T[]) => {
  const usedColors: string[] = [];

  return subjects.map((subject) => {
    const currentColor = subject.color ?? '';
    const hasUniqueColor = currentColor && !usedColors.some((color) => normalizeColor(color) === normalizeColor(currentColor));
    const color = hasUniqueColor ? currentColor : getNextSubjectColor(usedColors);

    usedColors.push(color);

    return {
      ...subject,
      color
    };
  });
};

function mergeDailyEntries(existingEntry: DailyEntry, addendum: DailyEntry): DailyEntry {
  const mergedCourses = [...existingEntry.courses];

  addendum.courses.forEach((newCourse) => {
    const existingCourseIndex = mergedCourses.findIndex((course) => course.name === newCourse.name);

    if (existingCourseIndex >= 0) {
      mergedCourses[existingCourseIndex] = {
        ...mergedCourses[existingCourseIndex],
        hours: mergedCourses[existingCourseIndex].hours + newCourse.hours,
      };
      return;
    }

    mergedCourses.push(newCourse);
  });

  const mergedSubjectTimes = [...existingEntry.subjectTimes];

  addendum.subjectTimes.forEach((newSubjectTime) => {
    const existingSubjectTimeIndex = mergedSubjectTimes.findIndex(
      (subjectTime) => subjectTime.subjectId === newSubjectTime.subjectId,
    );

    if (existingSubjectTimeIndex >= 0) {
      const existingSubjectTime = mergedSubjectTimes[existingSubjectTimeIndex];

      mergedSubjectTimes[existingSubjectTimeIndex] = {
        ...existingSubjectTime,
        classTime: existingSubjectTime.classTime + newSubjectTime.classTime,
        selfStudyTime: existingSubjectTime.selfStudyTime + newSubjectTime.selfStudyTime,
        hasClassEntry: existingSubjectTime.hasClassEntry || newSubjectTime.classTime > 0 || newSubjectTime.hasClassEntry,
        hasStudyEntry: existingSubjectTime.hasStudyEntry || newSubjectTime.selfStudyTime > 0 || newSubjectTime.hasStudyEntry,
      };
      return;
    }

    mergedSubjectTimes.push(newSubjectTime);
  });

  return {
    ...existingEntry,
    reliability: addendum.reliability,
    adminEffort: addendum.adminEffort,
    commuteTime: addendum.commuteTime,
    structuralChanges: addendum.structuralChanges,
    comment: addendum.comment,
    courses: mergedCourses,
    subjectTimes: mergedSubjectTimes,
    skipped: false,
  };
}

interface AppContentProps {
  participantId: string | null;
}

type ParticipantStatus = 'loading' | 'valid' | 'invalid';
type EntryMode = 'day' | 'week';

function WeeklyCategoryPanel({ categories }: { categories: Subject[] }) {
  const { t, language } = useI18n();

  return (
    <div className="h-full min-h-0 bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100 flex flex-col">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h3 className="font-semibold text-gray-900">{t('weeklyEntry.categories')}</h3>
      </div>
      <div className="space-y-2 overflow-y-auto min-h-0 flex-1 pr-1">
        {categories.map((category) => (
          <div
            key={category.id}
            className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
          >
            <div
              className="w-3 h-3 shrink-0 rounded-full"
              style={{ backgroundColor: category.color }}
            />
            <span className="text-sm font-medium text-gray-700">
              {getSubjectDisplayName(category, language)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AppContent({ participantId }: AppContentProps) {
  const pb = new PocketBase('https://api.methric.ch');

  const { t } = useI18n();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [entries, setEntries] = useState<Map<string, DailyEntry>>(new Map());
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<Subject[]>([]);
  const [defaultCommuteTime, setDefaultCommuteTime] = useState(0);
  const [participantName, setParticipantName] = useState<string>('');
  const [entryMode, setEntryMode] = useState<EntryMode>('day');
  const [participantStatus, setParticipantStatus] = useState<ParticipantStatus>('loading');
  const [submissionHistory, setSubmissionHistory] = useState<WorkloadStatusHistoryEntry[]>([]);
  const [missingSubmissionDates, setMissingSubmissionDates] = useState<Set<string>>(new Set());
  const [subjectPendingRemoval, setSubjectPendingRemoval] = useState<Subject | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function validateParticipant(id: string | null) {
      if (!id) {
        if (isMounted) {
          setParticipantStatus('invalid');
          setParticipantName('');
          setEntryMode('day');
        }
        return;
      }

      try {
        const participant = await pb.collection('participants').getOne(id);

        if (!isMounted) {
          return;
        }

        setParticipantName(participant.name ?? '');
        setEntryMode(participant.entryMode === 'week' ? 'week' : 'day');
        setParticipantStatus('valid');
      } catch (error) {
        console.error('Participant lookup failed:', error);

        if (!isMounted) {
          return;
        }

        setParticipantStatus('invalid');
        setParticipantName('');
        setEntryMode('day');
      }
    }

    setParticipantStatus('loading');
    validateParticipant(participantId);

    return () => {
      isMounted = false;
    };
  }, [participantId]);

  useEffect(() => {
    async function loadAvailableSubjects() {
      const allSubjects = await pb.collection('subjects').getFullList();

      return allSubjects.map((subject) => ({
        id: subject.id,
        key: subject.key,
        labelEn: subject.label_en,
        labelDe: subject.label_de,
        credits: subject.credits,
        color: subject.color ?? SUBJECT_COLORS[0],
      }));
    }

    loadAvailableSubjects()
      .then(setAvailableSubjects)
      .catch(console.error);
  }, []);

  useEffect(() => {
    async function loadSubjectsForParticipant(participantId: string) {
      const enrollments = await pb
        .collection("participant_subjects")
        .getFullList({
          filter: pb.filter("participant = {:participantId}", { participantId }),
          expand: "subject",
        });

      const subjects = enrollments.map((enrollment) => {
        const subject = enrollment.expand?.subject;

        return {
          id: subject.id,
          key: subject.key,
          labelEn: subject.label_en,
          labelDe: subject.label_de,
          credits: subject.credits,
          color: enrollment.color,
          participantSubjectId: enrollment.id,
        };
      });

      const subjectsWithUniqueColors = ensureUniqueSubjectColors(subjects);

      await Promise.all(
        subjectsWithUniqueColors
          .filter((subject, index) => normalizeColor(subject.color) !== normalizeColor(subjects[index].color))
          .map((subject) =>
            pb.collection('participant_subjects').update(subject.participantSubjectId, {
              color: subject.color,
            })
          )
      );

      return subjectsWithUniqueColors;
    }
    if (!participantId || participantStatus !== 'valid' || entryMode === 'week') {
      setSubjects([]);
      return;
    }

    loadSubjectsForParticipant(participantId)
      .then((subjects) => {
        console.log('Loaded subjects for participant:', subjects);
        setSubjects(subjects);
      })
      .catch(console.error);
  }, [participantId, participantStatus, entryMode]);

  useEffect(() => {
    let isMounted = true;

    async function loadSubmissionHistory(id: string) {
      const response = await pb.send<WorkloadStatusResponse>('/api/workload-status', {
        query: { participantId: id, startDate: SUBMISSION_TRACKING_START_DATE },
      });

      if (!isMounted) {
        return;
      }

      const responseEntryMode = response.participant?.entryMode === 'week' ? 'week' : 'day';
      const history = response.submissionHistory ?? [];
      setEntryMode(responseEntryMode);
      setSubmissionHistory(history);
      setMissingSubmissionDates(
        new Set(
          (response.missingPeriods ?? [])
            .filter((item) => item.periodType === responseEntryMode && item.periodStart)
            .map((item) => String(item.periodStart).slice(0, 10)),
        ),
      );

      const backendEntries = new Map<string, DailyEntry>();

      history
        .filter((item) => item.periodType === responseEntryMode && item.periodDate)
        .forEach((item) => {
          backendEntries.set(item.periodDate, {
            date: item.periodDate,
            courses: [],
            subjectTimes: item.subjects.map((subject) => ({
              subjectId: responseEntryMode === 'week' ? subject.key : subject.id,
              classTime: 0,
              selfStudyTime: 0,
              hasClassEntry: !!subject.hasClassEntry,
              hasStudyEntry: !!subject.hasStudyEntry,
            })),
            reliability: Number(item.dataRating ?? 0),
            adminEffort: Number(item.generalAdminTime ?? 0) / 60,
            commuteTime: Number(item.commuteTime ?? 0) / 60,
            structuralChanges: Number(item.structuralChanges ?? 0) / 60,
            comment: getNewestComment(item),
            skipped: false,
          });
        });

      setEntries(backendEntries);
    }

    if (!participantId || participantStatus !== 'valid') {
      setSubmissionHistory([]);
      setMissingSubmissionDates(new Set());
      setEntries(new Map());
      return;
    }

    loadSubmissionHistory(participantId).catch((error) => {
      console.error('Workload status lookup failed:', error);
      if (!isMounted) {
        return;
      }
      setSubmissionHistory([]);
      setMissingSubmissionDates(new Set());
      setEntries(new Map());
    });

    return () => {
      isMounted = false;
    };
  }, [participantId, participantStatus]);

  const saveEntry = async (entry: DailyEntry) => {
    if (!participantId) {
      throw new Error('Missing participantId');
    }

    const payload: SaveDailyEntryPayload | SaveWeeklyEntryPayload = entryMode === 'week'
      ? {
        participantId,
        weekStart: entry.date,
        reliability: entry.skipped ? 0 : entry.reliability,
        adminEffortMinutes: entry.skipped ? 0 : Math.round(entry.adminEffort * 60),
        commuteMinutes: 0,
        structuralChangesMinutes: entry.skipped ? 0 : Math.round((entry.structuralChanges ?? 0) * 60),
        comment: entry.comment ?? '',
        categoryTimes: entry.skipped
          ? []
          : entry.subjectTimes.map((subjectTime) => ({
            categoryId: subjectTime.subjectId,
            minutes: Math.round((subjectTime.classTime ?? 0) * 60),
          })),
      }
      : {
        participantId,
        date: entry.date,
        reliability: entry.skipped ? 0 : entry.reliability,
        adminEffortMinutes: entry.skipped ? 0 : Math.round(entry.adminEffort * 60),
        commuteMinutes: entry.skipped ? 0 : Math.round(entry.commuteTime * 60),
        comment: entry.comment ?? '',
        subjectTimes: entry.skipped
          ? []
          : entry.subjectTimes.map((subjectTime) => ({
            subjectId: subjectTime.subjectId,
            classMinutes: Math.round((subjectTime.classTime ?? 0) * 60),
            studyMinutes: Math.round((subjectTime.selfStudyTime ?? 0) * 60),
          })),
      };

    await pb.send(entryMode === 'week' ? '/api/submissions/weekly' : '/api/submissions/daily', {
      method: 'POST',
      body: payload,
    });

    setEntries((previousEntries) => {
      const newEntries = new Map(previousEntries);
      const previousEntry = newEntries.get(entry.date);
      const nextEntry =
        previousEntry && !previousEntry.skipped && !entry.skipped
          ? mergeDailyEntries(previousEntry, entry)
          : entry;

      newEntries.set(entry.date, nextEntry);

      const entriesObj = Object.fromEntries(newEntries);
      //localStorage.setItem(STORAGE_KEY, JSON.stringify(entriesObj));

      return newEntries;
    });

    setShowEntryModal(false);
    setShowViewModal(false);
  };

  const deleteEntry = async (date: string) => {
    if (!participantId) {
      throw new Error('Missing participantId');
    }

    await pb.send(entryMode === 'week' ? '/api/submissions/weekly' : '/api/submissions/daily', {
      method: 'DELETE',
      body: entryMode === 'week'
        ? {
          participantId,
          weekStart: date,
        }
        : {
          participantId,
          date,
        },
    });

    const newEntries = new Map(entries);
    newEntries.delete(date);
    setEntries(newEntries);

    const entriesObj = Object.fromEntries(newEntries);
    //localStorage.setItem(STORAGE_KEY, JSON.stringify(entriesObj));

    setShowViewModal(false);
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    const dateKey = format(date, 'yyyy-MM-dd');
    const existingEntry = entries.get(dateKey);

    if (existingEntry && !existingEntry.skipped) {
      setShowViewModal(true);
    } else {
      setShowEntryModal(true);
    }
  };

  const handleAddWorkload = () => {
    setShowViewModal(false);
    setShowEntryModal(true);
  };

  const handleAddSubject = async (subject: Subject) => {
    if (!participantId) {
      return;
    }

    const color = getNextSubjectColor(subjects.map((subject) => subject.color));
    const data = {
      participant: participantId,
      subject: subject.id,
      color,
    };

    const record = await pb.collection('participant_subjects').create(data);

    setSubjects((prev) => [
      ...prev,
      {
        ...subject,
        color: record.color ?? color,
        participantSubjectId: record.id,
      },
    ]);
  };

  const handleRemoveSubject = (id: string) => {
    const selectedSubject = subjects.find((subject) => subject.id === id);
    if (!selectedSubject) {
      return;
    }

    const subjectHasData = Array.from(entries.values()).some((entry) =>
      entry.subjectTimes.some(
        (subjectTime) =>
          subjectTime.subjectId === id &&
          (
            subjectTime.hasClassEntry ||
            subjectTime.hasStudyEntry ||
            subjectTime.classTime > 0 ||
            subjectTime.selfStudyTime > 0
          ),
      ),
    );

    if (subjectHasData) {
      setSubjectPendingRemoval(selectedSubject);
      return;
    }

    confirmRemoveSubject(selectedSubject).catch((error) => {
      console.error('Failed to remove subject:', error);
    });
  };

  const confirmRemoveSubject = async (selectedSubject: Subject | null = subjectPendingRemoval) => {
    if (!participantId) {
      return;
    }

    if (!selectedSubject) {
      return;
    }

    if (selectedSubject.participantSubjectId) {
      await pb.collection('participant_subjects').delete(selectedSubject.participantSubjectId);
    } else {
      const records = await pb.collection('participant_subjects').getFullList({
        filter: pb.filter('participant = {:participantId} && subject = {:subjectId}', {
          participantId,
          subjectId: selectedSubject.id,
        }),
      });

      await Promise.all(records.map((record) => pb.collection('participant_subjects').delete(record.id)));
    }

    setSubjects((prev) => prev.filter((subject) => subject.id !== selectedSubject.id));
    setSubjectPendingRemoval(null);
  };

  const existingEntry = selectedDate ? entries.get(format(selectedDate, 'yyyy-MM-dd')) || null : null;
  const activeSubjects = entryMode === 'week' ? WEEKLY_CATEGORIES : subjects;

  if (participantStatus === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 md:p-8" />
    );
  }

  if (participantStatus === 'invalid') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          <p className="text-red-700 font-semibold text-lg">{t('app.participantMissing')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-dvh overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-2 md:p-4">
      <div className="max-w-7xl h-full mx-auto flex flex-col min-h-0">
        <div className="mb-2 shrink-0 md:mb-4">
          <div className="mb-2 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 md:gap-4 lg:grid-cols-[minmax(0,1fr)_clamp(18rem,26vw,24rem)]">
            <div className="flex min-w-0 items-center gap-2 md:gap-3">
              <img
                src={logoMethric}
                alt={t('app.title')}
                className="h-9 w-auto max-w-[8.5rem] shrink-0 object-contain sm:max-w-[10rem] md:h-12 md:max-w-[12rem]"
              />
              {participantName && (
                <span className="truncate text-sm font-semibold text-gray-600 md:text-base">
                  {participantName}
                </span>
              )}
            </div>
            <div className="shrink-0 justify-self-end">
              <LanguageSelector />
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 grid grid-rows-[minmax(0,1.3fr)_minmax(0,1fr)] gap-3 md:gap-4 lg:grid-cols-[minmax(0,1fr)_clamp(18rem,26vw,24rem)] lg:grid-rows-1">
          <div className="min-h-0 lg:pr-2">
            <div className="h-full w-full max-w-5xl mx-auto">
              <Calendar
                currentDate={currentDate}
                onDateChange={setCurrentDate}
                selectedDate={selectedDate}
                onDateSelect={handleDateSelect}
                entriesMap={entries}
                missingSubmissionDates={missingSubmissionDates}
                subjects={activeSubjects}
                entryMode={entryMode}
              />
            </div>
          </div>

          <div className="min-h-0">
            {entryMode === 'week' ? (
              <WeeklyCategoryPanel categories={WEEKLY_CATEGORIES} />
            ) : (
              <CourseManagement
                subjects={subjects}
                onAddSubject={handleAddSubject}
                onRemoveSubject={handleRemoveSubject}
                availableSubjects={availableSubjects}
              />
            )}
          </div>
        </div>
      </div>

      {showEntryModal && selectedDate && (
        <DailyEntryModal
          date={selectedDate}
          onClose={() => {
            setShowEntryModal(false);
            setSelectedDate(null);
          }}
          onSave={saveEntry}
          existingEntry={existingEntry}
          availableCourses={availableSubjects.map((subject) => subject.labelEn)}
          subjects={activeSubjects}
          defaultCommuteTime={defaultCommuteTime}
          entryMode={entryMode}
        />
      )}

      {showViewModal && selectedDate && existingEntry && (
        <ViewEntryModal
          entry={existingEntry}
          date={selectedDate}
          onClose={() => {
            setShowViewModal(false);
            setSelectedDate(null);
          }}
          onDelete={() => {
            deleteEntry(format(selectedDate, 'yyyy-MM-dd')).catch((error) => {
              console.error('Failed to delete entry:', error);
            });
          }}
          onAddWorkload={handleAddWorkload}
          subjects={activeSubjects}
          entryMode={entryMode}
        />
      )}

      <ConfirmDialog
        open={!!subjectPendingRemoval}
        title={t('subject.removeTitle')}
        description={t('subject.removeConfirm')}
        confirmLabel={t('common.remove')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onCancel={() => setSubjectPendingRemoval(null)}
        onConfirm={() => confirmRemoveSubject(subjectPendingRemoval)}
      />
    </div>
  );
}

interface AppProps {
  participantId: string | null;
}

export default function App({ participantId }: AppProps) {
  return (
    <I18nProvider>
      <AppContent participantId={participantId} />
    </I18nProvider>
  );
}

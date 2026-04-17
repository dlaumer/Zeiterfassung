import { useState, useEffect } from 'react';
import { Calendar } from './components/Calendar';
import { DailyEntryModal } from './components/DailyEntryModal';
import { ViewEntryModal } from './components/ViewEntryModal';
import { CourseManagement, Subject } from './components/CourseManagement';
import { BookOpen } from 'lucide-react';
import { format } from 'date-fns';
import { I18nProvider, useI18n } from './i18n/i18n';

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

const AVAILABLE_COURSES = [
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'Computer Science',
  'Literature',
  'History',
  'Economics',
  'Philosophy',
  'Engineering'
];

const SUBJECT_COLORS = [
  '#ef4444',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
  '#14b8a6',
  '#6366f1',
];

const STORAGE_KEY = 'student-workload-tracker';
const SUBJECTS_STORAGE_KEY = 'student-workload-subjects';
const DEFAULT_COMMUTE_KEY = 'student-workload-default-commute';

const createParticipantId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `participant-${Date.now()}`;
};

const readParticipantIdFromPath = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const [firstPathSegment] = window.location.pathname.split('/').filter(Boolean);
  if (!firstPathSegment) {
    return null;
  }

  return decodeURIComponent(firstPathSegment);
};

const setParticipantIdInUrl = (participantId: string) => {
  if (typeof window === 'undefined') {
    return;
  }

  const encodedParticipantId = encodeURIComponent(participantId);
  const expectedPath = `/${encodedParticipantId}/`;

  if (window.location.pathname !== expectedPath) {
    window.history.replaceState({}, '', `${expectedPath}${window.location.search}${window.location.hash}`);
  }
};

const getStorageKeyForParticipant = (baseKey: string, participantId: string) => {
  return `${baseKey}-${participantId}`;
};

function AppContent() {
  const { t, language, setLanguage } = useI18n();
  const [participantId] = useState(() => {
    return readParticipantIdFromPath() ?? createParticipantId();
  });

  const entryStorageKey = getStorageKeyForParticipant(STORAGE_KEY, participantId);
  const subjectsStorageKey = getStorageKeyForParticipant(SUBJECTS_STORAGE_KEY, participantId);
  const commuteStorageKey = getStorageKeyForParticipant(DEFAULT_COMMUTE_KEY, participantId);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [entries, setEntries] = useState<Map<string, DailyEntry>>(new Map());
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [defaultCommuteTime, setDefaultCommuteTime] = useState(0);

  useEffect(() => {
    setParticipantIdInUrl(participantId);
  }, [participantId]);

  useEffect(() => {
    const stored = localStorage.getItem(entryStorageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setEntries(new Map(Object.entries(parsed)));
      } catch (e) {
        console.error('Failed to load entries:', e);
      }
    }

    const storedSubjects = localStorage.getItem(subjectsStorageKey);
    if (storedSubjects) {
      try {
        setSubjects(JSON.parse(storedSubjects));
      } catch (e) {
        console.error('Failed to load subjects:', e);
      }
    }

    const storedCommute = localStorage.getItem(commuteStorageKey);
    if (storedCommute) {
      try {
        setDefaultCommuteTime(parseFloat(storedCommute));
      } catch (e) {
        console.error('Failed to load default commute time:', e);
      }
    }
  }, [entryStorageKey, subjectsStorageKey, commuteStorageKey]);

  const saveEntry = (entry: DailyEntry) => {
    const newEntries = new Map(entries);
    newEntries.set(entry.date, entry);
    setEntries(newEntries);

    const entriesObj = Object.fromEntries(newEntries);
    localStorage.setItem(entryStorageKey, JSON.stringify(entriesObj));

    setShowEntryModal(false);
    setShowViewModal(false);
  };

  const deleteEntry = (date: string) => {
    const newEntries = new Map(entries);
    newEntries.delete(date);
    setEntries(newEntries);

    const entriesObj = Object.fromEntries(newEntries);
    localStorage.setItem(entryStorageKey, JSON.stringify(entriesObj));

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

  const handleAddSubject = (subjectName: string) => {
    const newSubject: Subject = {
      id: Date.now().toString(),
      name: subjectName,
      color: SUBJECT_COLORS[subjects.length % SUBJECT_COLORS.length]
    };
    const updatedSubjects = [...subjects, newSubject];
    setSubjects(updatedSubjects);
    localStorage.setItem(subjectsStorageKey, JSON.stringify(updatedSubjects));
  };

  const handleRemoveSubject = (id: string) => {
    const updatedSubjects = subjects.filter((s) => s.id !== id);
    setSubjects(updatedSubjects);
    localStorage.setItem(subjectsStorageKey, JSON.stringify(updatedSubjects));
  };

  const existingEntry = selectedDate ? entries.get(format(selectedDate, 'yyyy-MM-dd')) || null : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between gap-4 mb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <h1 className="font-bold text-gray-900">{t('app.title')}</h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setLanguage('en')}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  language === 'en' ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-white text-gray-600 border-gray-300'
                }`}
              >
                {t('language.en')}
              </button>
              <button
                onClick={() => setLanguage('de')}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  language === 'de' ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-white text-gray-600 border-gray-300'
                }`}
              >
                {t('language.de')}
              </button>
            </div>
          </div>
          <p className="text-gray-600">{t('app.subtitle')}</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Calendar
              currentDate={currentDate}
              onDateChange={setCurrentDate}
              selectedDate={selectedDate}
              onDateSelect={handleDateSelect}
              entriesMap={entries}
              subjects={subjects}
            />
          </div>

          <div className="lg:col-span-1">
            <CourseManagement
              subjects={subjects}
              onAddSubject={handleAddSubject}
              onRemoveSubject={handleRemoveSubject}
              availableSubjects={AVAILABLE_COURSES}
            />
          </div>
        </div>

        {entries.size === 0 && (
          <div className="mt-8 bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-indigo-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">{t('app.empty.title')}</h3>
            <p className="text-gray-600 mb-4">{t('app.empty.description')}</p>
            <p className="text-sm text-gray-500">{t('app.empty.hint')}</p>
          </div>
        )}
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
          availableCourses={AVAILABLE_COURSES}
          subjects={subjects}
          defaultCommuteTime={defaultCommuteTime}
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
          onDelete={() => deleteEntry(format(selectedDate, 'yyyy-MM-dd'))}
          onAddWorkload={handleAddWorkload}
          subjects={subjects}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  );
}

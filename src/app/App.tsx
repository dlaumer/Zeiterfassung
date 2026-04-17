import { useState, useEffect } from 'react';
import { Calendar } from './components/Calendar';
import { DailyEntryModal } from './components/DailyEntryModal';
import { ViewEntryModal } from './components/ViewEntryModal';
import { CourseManagement, Subject } from './components/CourseManagement';
import { BookOpen } from 'lucide-react';
import { format } from 'date-fns';

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
  '#ef4444', // red
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#14b8a6', // teal
  '#6366f1', // indigo
];

const STORAGE_KEY = 'student-workload-tracker';
const SUBJECTS_STORAGE_KEY = 'student-workload-subjects';
const DEFAULT_COMMUTE_KEY = 'student-workload-default-commute';

export default function App() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [entries, setEntries] = useState<Map<string, DailyEntry>>(new Map());
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [defaultCommuteTime, setDefaultCommuteTime] = useState(0);

  // Load entries from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setEntries(new Map(Object.entries(parsed)));
      } catch (e) {
        console.error('Failed to load entries:', e);
      }
    }

    // Load subjects
    const storedSubjects = localStorage.getItem(SUBJECTS_STORAGE_KEY);
    if (storedSubjects) {
      try {
        setSubjects(JSON.parse(storedSubjects));
      } catch (e) {
        console.error('Failed to load subjects:', e);
      }
    }

    // Load default commute time
    const storedCommute = localStorage.getItem(DEFAULT_COMMUTE_KEY);
    if (storedCommute) {
      try {
        setDefaultCommuteTime(parseFloat(storedCommute));
      } catch (e) {
        console.error('Failed to load default commute time:', e);
      }
    }
  }, []);

  // Save entries to localStorage
  const saveEntry = (entry: DailyEntry) => {
    const newEntries = new Map(entries);
    newEntries.set(entry.date, entry);
    setEntries(newEntries);

    const entriesObj = Object.fromEntries(newEntries);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entriesObj));

    setShowEntryModal(false);
    setShowViewModal(false);
  };

  const deleteEntry = (date: string) => {
    const newEntries = new Map(entries);
    newEntries.delete(date);
    setEntries(newEntries);

    const entriesObj = Object.fromEntries(newEntries);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entriesObj));

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
    localStorage.setItem(SUBJECTS_STORAGE_KEY, JSON.stringify(updatedSubjects));
  };

  const handleRemoveSubject = (id: string) => {
    // Check if any entries have data for this subject
    let hasData = false;
    entries.forEach(entry => {
      if (entry.subjectTimes) {
        const subjectTime = entry.subjectTimes.find(st => st.subjectId === id);
        if (subjectTime && (subjectTime.classTime > 0 || subjectTime.selfStudyTime > 0)) {
          hasData = true;
        }
      }
    });

    if (hasData) {
      const confirmed = window.confirm(
        'This subject has existing data in your entries. Removing it may cause data loss. Are you sure you want to remove this subject?'
      );
      if (!confirmed) return;
    } else {
      const confirmed = window.confirm('Are you sure you want to remove this subject?');
      if (!confirmed) return;
    }

    const updatedSubjects = subjects.filter(s => s.id !== id);
    setSubjects(updatedSubjects);
    localStorage.setItem(SUBJECTS_STORAGE_KEY, JSON.stringify(updatedSubjects));
  };

  const handleUpdateDefaultCommute = (time: number) => {
    setDefaultCommuteTime(time);
    localStorage.setItem(DEFAULT_COMMUTE_KEY, time.toString());
  };

  // Calculate statistics
  const calculateStats = () => {
    let totalHours = 0;
    let daysTracked = 0;
    const courseHours: { [key: string]: number[] } = {};

    entries.forEach(entry => {
      if (!entry.skipped) {
        daysTracked++;
        entry.courses.forEach(course => {
          totalHours += course.hours;
          if (!courseHours[course.name]) {
            courseHours[course.name] = [];
          }
          courseHours[course.name].push(course.hours);
        });
        totalHours += entry.adminEffort + entry.commuteTime;
      }
    });

    const courseAverages: { [key: string]: number } = {};
    Object.entries(courseHours).forEach(([course, hours]) => {
      courseAverages[course] = hours.reduce((a, b) => a + b, 0) / hours.length;
    });

    return {
      totalHours,
      averagePerDay: daysTracked > 0 ? totalHours / daysTracked : 0,
      daysTracked,
      courseAverages
    };
  };

  const stats = calculateStats();
  const existingEntry = selectedDate ? entries.get(format(selectedDate, 'yyyy-MM-dd')) || null : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <h1 className="font-bold text-gray-900">Daily Workload Tracker</h1>
          </div>
          <p className="text-gray-600">Track your study time and stay on top of your workload</p>
        </div>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Calendar - Takes 2 columns on large screens */}
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

          {/* Course Management */}
          <div className="lg:col-span-1">
            <CourseManagement
              subjects={subjects}
              onAddSubject={handleAddSubject}
              onRemoveSubject={handleRemoveSubject}
              availableSubjects={AVAILABLE_COURSES}
            />
          </div>
        </div>

        {/* Empty State */}
        {entries.size === 0 && (
          <div className="mt-8 bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-indigo-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Welcome to Your Workload Tracker!</h3>
            <p className="text-gray-600 mb-4">
              Start by clicking on any day in the calendar to log your study time.
            </p>
            <p className="text-sm text-gray-500">
              Track courses, admin work, commute time, and more to understand your daily workload better.
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
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
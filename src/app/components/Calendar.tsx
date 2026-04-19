import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek, addMonths, subMonths } from 'date-fns';
import { useI18n } from '../i18n/i18n';
import { Subject } from './CourseManagement';

interface CalendarProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
  entriesMap: Map<string, any>;
  subjects: Subject[];
}

export function Calendar({ currentDate, onDateChange, selectedDate, onDateSelect, entriesMap, subjects }: CalendarProps) {
  const { t } = useI18n();
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weekDays = [
    t('calendar.week.mon'),
    t('calendar.week.tue'),
    t('calendar.week.wed'),
    t('calendar.week.thu'),
    t('calendar.week.fri'),
    t('calendar.week.sat'),
    t('calendar.week.sun')
  ];

  const today = new Date();

  const handlePrevMonth = () => {
    onDateChange(subMonths(currentDate, 1));
  };

  const handleNextMonth = () => {
    onDateChange(addMonths(currentDate, 1));
  };

  const hasEntry = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return entriesMap.has(dateKey);
  };

  const getSubjectColorsForDate = (date: Date): string[] => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const entry = entriesMap.get(dateKey);

    if (!entry || entry.skipped || !entry.subjectTimes) return [];

    const loggedSubjectIds = entry.subjectTimes
      .map((st: any) => {
        if ((st.hasClassEntry || st.hasStudyEntry) || (st.classTime > 0 || st.selfStudyTime > 0)) {
          return st.subjectId;
        }
      });

    const colors = loggedSubjectIds
      .map((id: string) => subjects.find(s => s.id === id)?.color)
      .filter((color: string | undefined): color is string => !!color);

    return colors;
  };

  return (
    <div className="h-full bg-white rounded-2xl p-3 md:p-5 shadow-sm border border-gray-100 flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-2 md:mb-3 shrink-0">
        <h2 className="font-semibold text-gray-900 text-lg md:text-xl">
          {format(currentDate, 'MMMM yyyy')}
        </h2>
        <div className="flex gap-1 md:gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 md:p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-4 h-4 md:w-5 md:h-5 text-gray-600" />
          </button>
          <button
            onClick={handleNextMonth}
            className="p-1.5 md:p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-gray-600" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 md:gap-2 mb-1 md:mb-1.5 shrink-0">
        {weekDays.map(day => (
          <div key={day} className="text-center text-[11px] md:text-sm text-gray-500 font-medium py-1.5 md:py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 md:gap-2 auto-rows-fr flex-1 min-h-0">
        {days.map(day => {
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isToday = isSameDay(day, today);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const hasEntryDay = hasEntry(day);
          const subjectColors = getSubjectColorsForDate(day);

          return (
            <button
              key={day.toString()}
              onClick={() => onDateSelect(day)}
              disabled={!isCurrentMonth}
              className={`
                h-full min-h-0 rounded-lg md:rounded-xl px-1 py-1 text-xs md:text-sm font-medium transition-all relative
                ${!isCurrentMonth ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-gray-50'}
                ${hasEntryDay ? 'bg-gray-200 text-gray-700' : ''}
                ${!isSelected && !hasEntryDay ? 'text-gray-700' : ''}
              `}
            >
              <div className="h-full flex flex-col items-center justify-between">
                {isToday ? (
                  <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center">
                    {format(day, 'd')}
                  </div>
                ) : (
                  <div className="h-6 md:h-8 flex items-center justify-center">
                    {format(day, 'd')}
                  </div>
                )}

                <div className="h-3.5 md:h-5 w-full flex items-end justify-center overflow-hidden">
                  {subjectColors.length > 0 && (
                    <div className="max-w-[90%] flex flex-wrap justify-center gap-0.5 md:gap-1 leading-none">
                      {subjectColors.map((color, index) => (
                        <div
                          key={index}
                          className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

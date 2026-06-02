import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, eachWeekOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek, addMonths, subMonths } from 'date-fns';
import { useI18n } from '../i18n/i18n';
import { getDateLocale } from '../i18n/dateLocale';
import { Subject } from './CourseManagement';

interface CalendarProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
  entriesMap: Map<string, any>;
  missingSubmissionDates: Set<string>;
  subjects: Subject[];
  entryMode?: 'day' | 'week';
}

interface DotColor {
  color: string;
  opacity: number;
}

export function Calendar({ currentDate, onDateChange, selectedDate, onDateSelect, entriesMap, missingSubmissionDates, subjects, entryMode = 'day' }: CalendarProps) {
  const { t, language } = useI18n();
  const dateLocale = getDateLocale(language);
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weeks = eachWeekOfInterval({ start: calendarStart, end: calendarEnd }, { weekStartsOn: 1 });
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
  const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });

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

  const isMissingSubmissionDay = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return missingSubmissionDates.has(dateKey);
  };

  const getSubjectColorsForDate = (date: Date): DotColor[] => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const entry = entriesMap.get(dateKey);

    if (!entry || entry.skipped || !entry.subjectTimes) return [];

    return entry.subjectTimes
      .map((st: any) => {
        const subjectColor = subjects.find(s => s.id === st.subjectId)?.color;
        const hasClassTime = !!st.hasClassEntry || st.classTime > 0;
        const hasStudyTime = !!st.hasStudyEntry || st.selfStudyTime > 0;

        if (!subjectColor || (!hasClassTime && !hasStudyTime)) {
          return null;
        }

        return {
          color: subjectColor,
          opacity: hasClassTime ? 1 : 0.35,
        };
      })
      .filter((dotColor: DotColor | null): dotColor is DotColor => !!dotColor);
  };

  const renderDots = (colors: DotColor[]) => (
    colors.length > 0 && (
      <div className="max-w-[90%] flex flex-wrap justify-center gap-0.5 md:gap-1 leading-none">
        {colors.map(({ color, opacity }, index) => (
          <div
            key={`${color}-${index}`}
            className="w-1 h-1 md:w-2 md:h-2 rounded-full shrink-0"
            style={{ backgroundColor: color, opacity }}
          />
        ))}
      </div>
    )
  );

  return (
    <div className="h-full bg-white rounded-2xl p-3 md:p-5 shadow-sm border border-gray-100 flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-2 md:mb-3 shrink-0">
        <h2 className="font-semibold text-gray-900 text-lg md:text-xl">
          {format(currentDate, 'MMMM yyyy', { locale: dateLocale })}
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

      {entryMode !== 'week' && (
        <div className="grid grid-cols-7 gap-1 md:gap-2 mb-1 md:mb-1.5 shrink-0">
          {weekDays.map(day => (
            <div key={day} className="text-center text-[11px] md:text-sm text-gray-500 font-medium py-1.5 md:py-2">
              {day}
            </div>
          ))}
        </div>
      )}

      {entryMode === 'week' ? (
        <div
          className="grid min-h-0 flex-1 gap-1 overflow-hidden md:gap-2"
          style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(0, 1fr))` }}
        >
          {weeks.map(weekStart => {
          const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
          const weekKey = format(weekStart, 'yyyy-MM-dd');
          const isCurrentMonth = isSameMonth(weekStart, currentDate) || isSameMonth(weekEnd, currentDate);
          const isSelected = selectedDate && isSameDay(weekStart, selectedDate);
          const isCurrentWeek = isSameDay(weekStart, currentWeekStart);
          const hasEntryWeek = hasEntry(weekStart);
          const isMissingWeek = isMissingSubmissionDay(weekStart);
          const subjectColors = getSubjectColorsForDate(weekStart);

          return (
            <button
              key={weekKey}
              onClick={() => onDateSelect(weekStart)}
              className={`
                h-full min-h-0 rounded-lg md:rounded-xl px-2.5 py-1.5 text-[10px] font-medium transition-all relative sm:text-xs md:px-3.5 md:py-2.5 md:text-sm
                ${!isCurrentMonth ? 'text-gray-300 hover:bg-gray-50' : 'hover:bg-gray-50'}
                ${hasEntryWeek ? 'bg-gray-200 text-gray-700' : ''}
                ${!hasEntryWeek && isMissingWeek && !isCurrentWeek ? 'bg-red-50 text-gray-700 hover:bg-red-100/70' : ''}
                ${!isSelected && !hasEntryWeek && !isCurrentWeek ? 'text-gray-700' : ''}
              `}
            >
              <div className="h-full flex items-center justify-between gap-3">
                <div className="text-left">
                  <div
                    className={`
                      inline-block max-w-full truncate font-semibold leading-tight
                      ${isCurrentWeek ? 'rounded-full bg-indigo-500 px-2 py-0.5 text-white' : ''}
                    `}
                  >
                    {format(weekStart, 'd MMM', { locale: dateLocale })} - {format(weekEnd, 'd MMM', { locale: dateLocale })}
                  </div>
                  <div className="truncate text-[9px] leading-tight text-gray-500 sm:text-[11px] md:text-xs">{t('history.week')}</div>
                </div>
                <div className="min-w-8 flex justify-end overflow-hidden md:min-w-12">
                  {renderDots(subjectColors)}
                </div>
              </div>
            </button>
          );
        })}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1 md:gap-2 auto-rows-fr flex-1 min-h-0">
          {days.map(day => {
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isToday = isSameDay(day, today);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const hasEntryDay = hasEntry(day);
          const isMissingDay = isMissingSubmissionDay(day);
          const subjectColors = getSubjectColorsForDate(day);

          return (
            <button
              key={day.toString()}
              onClick={() => onDateSelect(day)}
              className={`
                h-full min-h-0 rounded-lg md:rounded-xl px-1 py-1 text-xs md:text-sm font-medium transition-all relative
                ${!isCurrentMonth ? 'text-gray-300 hover:bg-gray-50' : 'hover:bg-gray-50'}
                ${hasEntryDay ? 'bg-gray-200 text-gray-700' : ''}
                ${!hasEntryDay && isMissingDay && !isToday ? 'bg-red-50 text-gray-700 hover:bg-red-100/70' : ''}
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

                <div className="h-3.5 md:h-5 w-full flex justify-center overflow-hidden">
                  {renderDots(subjectColors)}
                </div>
              </div>
            </button>
          );
        })}
        </div>
      )}
    </div>
  );
}

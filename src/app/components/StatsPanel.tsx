import { BookOpen, Clock, TrendingUp } from 'lucide-react';

interface StatsPanelProps {
  totalHours: number;
  averagePerDay: number;
  daysTracked: number;
  courseAverages: { [key: string]: number };
}

export function StatsPanel({ totalHours, averagePerDay, daysTracked, courseAverages }: StatsPanelProps) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <h3 className="font-semibold text-gray-900 mb-4">Your Statistics</h3>

      <div className="space-y-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-indigo-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-indigo-600" />
              <span className="text-xs text-indigo-600 font-medium">Total Hours</span>
            </div>
            <p className="font-semibold text-gray-900">{totalHours.toFixed(1)}h</p>
          </div>

          <div className="bg-green-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span className="text-xs text-green-600 font-medium">Avg/Day</span>
            </div>
            <p className="font-semibold text-gray-900">{averagePerDay.toFixed(1)}h</p>
          </div>

          <div className="bg-purple-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-4 h-4 text-purple-600" />
              <span className="text-xs text-purple-600 font-medium">Days</span>
            </div>
            <p className="font-semibold text-gray-900">{daysTracked}</p>
          </div>
        </div>

        {/* Course Averages */}
        {Object.keys(courseAverages).length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Average Time per Course</h4>
            <div className="space-y-2">
              {Object.entries(courseAverages)
                .sort((a, b) => b[1] - a[1])
                .map(([course, avg]) => (
                  <div key={course} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{course}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full"
                          style={{ width: `${Math.min((avg / 5) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-900 w-12 text-right">
                        {avg.toFixed(1)}h
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {daysTracked === 0 && (
          <div className="text-center py-8 text-gray-400">
            <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Start tracking your workload to see statistics!</p>
          </div>
        )}
      </div>
    </div>
  );
}

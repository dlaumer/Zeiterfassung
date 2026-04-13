import { Plus, X, BookOpen } from 'lucide-react';
import { useState } from 'react';

export interface Subject {
  id: string;
  name: string;
  color: string;
}

interface CourseManagementProps {
  subjects: Subject[];
  onAddSubject: (subjectName: string) => void;
  onRemoveSubject: (id: string) => void;
  availableSubjects: string[];
}

export function CourseManagement({
  subjects,
  onAddSubject,
  onRemoveSubject,
  availableSubjects
}: CourseManagementProps) {
  const [showAddSubject, setShowAddSubject] = useState(false);

  const handleAddSubject = (subjectName: string) => {
    onAddSubject(subjectName);
    setShowAddSubject(false);
  };

  const availableToAdd = availableSubjects.filter(
    subject => !subjects.find(s => s.name === subject)
  );

  const canAddMore = subjects.length < 10;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Course Management</h3>
        {canAddMore && (
          <button
            onClick={() => setShowAddSubject(true)}
            className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        )}
      </div>

      {subjects.length === 0 ? (
        <div className="text-center py-8">
          <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-50 text-gray-400" />
          <p className="text-sm text-gray-400 mb-3">No subjects added yet</p>
          <button
            onClick={() => setShowAddSubject(true)}
            className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors text-sm font-medium"
          >
            Add Your First Subject
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {subjects.map(subject => (
            <div
              key={subject.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: subject.color }}
                />
                <span className="text-sm font-medium text-gray-700">{subject.name}</span>
              </div>
              <button
                onClick={() => onRemoveSubject(subject.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-200 rounded"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          ))}
        </div>
      )}

      {!canAddMore && (
        <p className="text-xs text-gray-500 mt-3 text-center">
          Maximum of 10 subjects reached
        </p>
      )}

      {showAddSubject && availableToAdd.length > 0 && (
        <div className="mt-4 bg-gray-50 rounded-xl p-4 space-y-3">
          <p className="text-sm text-gray-600">Select a subject to add:</p>
          <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
            {availableToAdd.map(subject => (
              <button
                key={subject}
                onClick={() => handleAddSubject(subject)}
                className="px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-indigo-50 hover:border-indigo-300 transition-colors text-sm text-left"
              >
                {subject}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowAddSubject(false)}
            className="text-sm text-gray-500 hover:text-gray-700 w-full text-center"
          >
            Cancel
          </button>
        </div>
      )}

      {showAddSubject && availableToAdd.length === 0 && (
        <div className="mt-4 bg-gray-50 rounded-xl p-4 text-center">
          <p className="text-sm text-gray-500">All available subjects have been added</p>
          <button
            onClick={() => setShowAddSubject(false)}
            className="text-sm text-indigo-600 hover:text-indigo-700 mt-2"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}

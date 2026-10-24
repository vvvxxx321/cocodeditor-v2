import React from "react";
import { AlertCircle, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";

interface Problem {
  type: "error" | "warning";
  message: string;
  file: string;
  line: number;
  column: number;
}

interface ProblemsPanelProps {
  problems: Problem[];
}

export const ProblemsPanel: React.FC<ProblemsPanelProps> = ({ problems }) => {
  const [expandedFiles, setExpandedFiles] = React.useState<Set<string>>(new Set());

  const toggleFile = (file: string) => {
    const newExpanded = new Set(expandedFiles);
    if (newExpanded.has(file)) {
      newExpanded.delete(file);
    } else {
      newExpanded.add(file);
    }
    setExpandedFiles(newExpanded);
  };

  const problemsByFile = problems.reduce((acc, problem) => {
    if (!acc[problem.file]) {
      acc[problem.file] = [];
    }
    acc[problem.file].push(problem);
    return acc;
  }, {} as Record<string, Problem[]>);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">Problems</span>
          <span className="text-xs text-gray-500">({problems.length})</span>
        </div>
        <div className="flex items-center space-x-2 text-xs text-gray-500">
          <span className="flex items-center">
            <AlertCircle className="h-3 w-3 mr-1 text-red-500" />
            {problems.filter(p => p.type === "error").length} errors
          </span>
          <span className="flex items-center">
            <AlertTriangle className="h-3 w-3 mr-1 text-yellow-500" />
            {problems.filter(p => p.type === "warning").length} warnings
          </span>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {Object.entries(problemsByFile).map(([file, fileProblems]) => (
          <div key={file} className="mb-2">
            <button
              onClick={() => toggleFile(file)}
              className="flex items-center space-x-1 text-sm font-medium text-gray-700 hover:text-gray-900 w-full px-2 py-1 hover:bg-gray-50 rounded"
            >
              {expandedFiles.has(file) ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <span>{file}</span>
              <span className="text-xs text-gray-500">({fileProblems.length})</span>
            </button>
            {expandedFiles.has(file) && (
              <div className="ml-6 mt-1 space-y-1">
                {fileProblems.map((problem, index) => (
                  <div
                    key={index}
                    className="flex items-start space-x-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer"
                  >
                    {problem.type === "error" ? (
                      <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <div className="text-sm">{problem.message}</div>
                      <div className="text-xs text-gray-500">
                        Line {problem.line}, Column {problem.column}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}; 
import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Clock, 
  Server, 
  Check, 
  XCircle, 
  ArrowRight, 
  PlayCircle,
  AlertCircle 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

export interface ExecutionResult {
  id: string;
  timestamp: Date;
  language: string;
  status: 'success' | 'error' | 'timeout';
  executionTime: number | null;
  memoryUsed: number | null;
  output: string;
  error: string | null;
  code: string;
}

interface ExecutionHistoryProps {
  history: ExecutionResult[];
  onSelectExecution: (execution: ExecutionResult) => void;
  onRerunExecution: (code: string) => void;
  activeExecutionId?: string | null;
}

const ExecutionHistory: React.FC<ExecutionHistoryProps> = ({ 
  history, 
  onSelectExecution,
  onRerunExecution,
  activeExecutionId = null
}) => {
  const { theme } = useTheme();
  
  const formatMemory = (bytes: number | null) => {
    if (bytes === null) return "N/A";
    if (bytes < 1024) return `${bytes} KB`;
    return `${(bytes / 1024).toFixed(2)} MB`;
  };

  const formatTime = (ms: number | null) => {
    if (ms === null) return "N/A";
    if (ms < 1) return "< 1ms";
    return `${ms.toFixed(2)}ms`;
  };
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'timeout':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <div className={`h-full ${theme === 'dark' ? 'bg-gray-900/40' : 'bg-white/90'} rounded-lg`}>
      <div className="p-4">
        <h3 className={`text-sm font-medium mb-4 ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>
          Execution History
        </h3>
        
        {history.length === 0 ? (
          <div className={`text-center py-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
            <Clock className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>No execution history yet</p>
            <p className="text-xs mt-1">Run your code to see the history</p>
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-250px)]">
            <div className="space-y-3">
              {history.map((execution) => (
                <div 
                  key={execution.id}
                  className={`p-3 rounded-lg cursor-pointer transition-colors border ${
                    activeExecutionId === execution.id 
                      ? theme === 'dark' 
                        ? 'bg-gray-800 border-blue-700' 
                        : 'bg-blue-50 border-blue-200'
                      : theme === 'dark'
                        ? 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                        : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => onSelectExecution(execution)}
                >
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center">
                      {getStatusIcon(execution.status)}
                      <span className={`ml-2 text-sm font-medium capitalize ${
                        theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
                      }`}>
                        {execution.language}
                      </span>
                    </div>
                    <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      {formatDistanceToNow(execution.timestamp, { addSuffix: true })}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      <Clock className="h-3 w-3 inline mr-1" />
                      {formatTime(execution.executionTime)}
                    </div>
                    <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      <Server className="h-3 w-3 inline mr-1" />
                      {formatMemory(execution.memoryUsed)}
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <div className={`text-xs truncate max-w-[180px] ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      {execution.output ? (
                        <span className="italic">"{execution.output.substring(0, 30)}..."</span>
                      ) : execution.error ? (
                        <span className="text-red-500">Error occurred</span>
                      ) : (
                        <span>No output</span>
                      )}
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7" 
                      onClick={(e) => {
                        e.stopPropagation();
                        onRerunExecution(execution.code);
                      }}
                    >
                      <PlayCircle className={`h-4 w-4 ${
                        theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                      }`} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
};

export default ExecutionHistory; 
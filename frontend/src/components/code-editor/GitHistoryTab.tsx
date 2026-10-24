import React from 'react';
import { useTheme } from "@/contexts/ThemeContext";
import { GitCommit } from 'lucide-react';

interface CommitHistoryItem {
  id: string;
  message: string;
  author: string;
  timestamp: string;
}

// Sample data for history
const sampleHistory: CommitHistoryItem[] = [
  {
    id: "c1",
    message: "Updated index.js",
    author: "John Doe",
    timestamp: "5 minutes ago"
  },
  {
    id: "c2",
    message: "Added Button component",
    author: "Jane Smith",
    timestamp: "Yesterday at 2:45 PM"
  },
  {
    id: "c3",
    message: "Fixed navigation bug",
    author: "John Doe",
    timestamp: "2 days ago"
  },
  {
    id: "c4",
    message: "Initial commit",
    author: "Jane Smith",
    timestamp: "3 days ago"
  }
];

export const GitHistoryTab: React.FC = () => {
  const { theme } = useTheme();
  const [history, setHistory] = React.useState<CommitHistoryItem[]>(sampleHistory);
  
  return (
    <div className="h-full overflow-auto">
      <h3 className={`font-semibold mb-2 ${
        theme === 'dark' ? 'text-gray-300' : 'text-gray-900'
      }`}>
        Version History
      </h3>
      
      <div className="space-y-2">
        {history.map((commit) => (
          <div 
            key={commit.id}
            className={`flex items-start space-x-2 p-2 rounded ${
              theme === 'dark' 
                ? 'hover:bg-gray-800 text-gray-300' 
                : 'hover:bg-gray-100 text-gray-700'
            } cursor-pointer`}
          >
            <GitCommit className="h-4 w-4 mt-1 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className={`font-medium truncate ${
                theme === 'dark' ? 'text-gray-200' : 'text-gray-900'
              }`}>
                {commit.message}
              </p>
              <div className={`flex justify-between text-xs ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`}>
                <span>{commit.author}</span>
                <span>{commit.timestamp}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}; 
import React from 'react';
import { useTheme } from "@/contexts/ThemeContext";
import { File, Folder } from 'lucide-react';

interface FileItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  children?: FileItem[];
  path?: string;
}

interface ProjectFilesTabProps {
  files: FileItem[];
}

export const ProjectFilesTab: React.FC<ProjectFilesTabProps> = ({ files }) => {
  const { theme } = useTheme();
  
  const renderFileTree = (items: FileItem[], level = 0) => {
    return items.map((item) => (
      <div key={item.id} style={{ paddingLeft: `${level * 16}px` }} className="py-1">
        <div className={`flex items-center space-x-2 rounded px-2 py-1 ${
          theme === 'dark' 
            ? 'hover:bg-gray-800 text-gray-300 hover:text-gray-100' 
            : 'hover:bg-gray-100 text-gray-700 hover:text-gray-900'
        } cursor-pointer`}>
          {item.type === 'folder' ? (
            <Folder className="h-4 w-4" />
          ) : (
            <File className="h-4 w-4" />
          )}
          <span className="text-sm">{item.name}</span>
        </div>
        {item.children && item.children.length > 0 && (
          <div className="mt-1">
            {renderFileTree(item.children, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  return (
    <div className="h-full overflow-auto">
      <h3 className={`font-semibold mb-2 ${
        theme === 'dark' ? 'text-gray-300' : 'text-gray-900'
      }`}>
        Project Files
      </h3>
      {files.length === 0 ? (
        <div className={`text-sm ${
          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
        }`}>
          No files found
        </div>
      ) : (
        <div>{renderFileTree(files)}</div>
      )}
    </div>
  );
}; 
import React from 'react';
import { 
  Select, 
  SelectContent, 
  SelectGroup, 
  SelectItem, 
  SelectLabel, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useTheme } from "@/contexts/ThemeContext";
import { 
  FileCode, 
  Braces, 
  Cpu, 
  Coffee,
  Gem,
  FileType,
  Hash,
  PenTool,
  Infinity,
  PackageCheck
} from "lucide-react";

export interface Language {
  id: string;
  name: string;
  displayName: string;
  icon: React.ReactNode;
  description: string;
  fileExtensions: string[];
}

export const SUPPORTED_LANGUAGES: Language[] = [
  {
    id: 'javascript',
    name: 'javascript',
    displayName: 'JavaScript',
    icon: <FileCode className="h-4 w-4 text-yellow-500" />,
    description: 'JavaScript (Node.js 12.14.0)',
    fileExtensions: ['js']
  },
  {
    id: 'typescript',
    name: 'typescript',
    displayName: 'TypeScript',
    icon: <FileCode className="h-4 w-4 text-blue-500" />,
    description: 'TypeScript (3.7.4)',
    fileExtensions: ['ts']
  },
  {
    id: 'python',
    name: 'python',
    displayName: 'Python',
    icon: <Infinity className="h-4 w-4 text-blue-500" />,
    description: 'Python (3.8.1)',
    fileExtensions: ['py']
  },
  {
    id: 'c',
    name: 'c',
    displayName: 'C',
    icon: <Braces className="h-4 w-4 text-gray-500" />,
    description: 'C (GCC 9.2.0)',
    fileExtensions: ['c']
  },
  {
    id: 'cpp',
    name: 'cpp',
    displayName: 'C++',
    icon: <Braces className="h-4 w-4 text-blue-500" />,
    description: 'C++ (GCC 9.2.0)',
    fileExtensions: ['cpp', 'cc', 'cxx', 'h', 'hpp']
  },
  {
    id: 'java',
    name: 'java',
    displayName: 'Java',
    icon: <Coffee className="h-4 w-4 text-red-500" />,
    description: 'Java (OpenJDK 13.0.1)',
    fileExtensions: ['java']
  },
  {
    id: 'ruby',
    name: 'ruby',
    displayName: 'Ruby',
    icon: <Gem className="h-4 w-4 text-red-500" />,
    description: 'Ruby (2.7.0)',
    fileExtensions: ['rb']
  },
  {
    id: 'go',
    name: 'go',
    displayName: 'Go',
    icon: <PackageCheck className="h-4 w-4 text-blue-500" />,
    description: 'Go (1.13.5)',
    fileExtensions: ['go']
  },
  {
    id: 'rust',
    name: 'rust',
    displayName: 'Rust',
    icon: <Cpu className="h-4 w-4 text-orange-500" />,
    description: 'Rust (1.40.0)',
    fileExtensions: ['rs']
  },
  {
    id: 'csharp',
    name: 'csharp',
    displayName: 'C#',
    icon: <Hash className="h-4 w-4 text-purple-500" />,
    description: 'C# (Mono 6.6.0.161)',
    fileExtensions: ['cs']
  },
  {
    id: 'swift',
    name: 'swift',
    displayName: 'Swift',
    icon: <PenTool className="h-4 w-4 text-orange-500" />,
    description: 'Swift (5.2.3)',
    fileExtensions: ['swift']
  },
  {
    id: 'php',
    name: 'php',
    displayName: 'PHP',
    icon: <FileType className="h-4 w-4 text-purple-700" />,
    description: 'PHP (7.4.1)',
    fileExtensions: ['php']
  }
];

interface LanguageSelectorProps {
  currentLanguage: string;
  onLanguageChange: (language: string) => void;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ 
  currentLanguage, 
  onLanguageChange 
}) => {
  const { theme } = useTheme();
  
  // Find the current language object
  const currentLang = SUPPORTED_LANGUAGES.find(lang => 
    lang.id === currentLanguage || lang.name === currentLanguage
  ) || SUPPORTED_LANGUAGES[0];

  return (
    <Select
      value={currentLang.id}
      onValueChange={onLanguageChange}
    >
      <SelectTrigger 
        className={`w-[180px] h-9 ${theme === 'dark' ? 'bg-gray-800/50 text-gray-200 border-gray-700' : 'bg-white/80 text-gray-900 border-gray-200'}`}
      >
        <SelectValue>
          <div className="flex items-center">
            {currentLang.icon}
            <span className="ml-2">{currentLang.displayName}</span>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className={`${theme === 'dark' ? 'bg-gray-800 text-gray-200 border-gray-700' : 'bg-white text-gray-900 border-gray-200'}`}>
        <SelectGroup>
          <SelectLabel>Languages</SelectLabel>
          {SUPPORTED_LANGUAGES.map(lang => (
            <SelectItem 
              key={lang.id} 
              value={lang.id}
              className="flex items-center py-2"
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center">
                  {lang.icon}
                  <span className="ml-2">{lang.displayName}</span>
                </div>
                <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  {lang.fileExtensions[0]}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
};

export default LanguageSelector; 
import React from "react";
import { GitBranch, GitCommit, GitPullRequest, Wifi, WifiOff, Bell, Settings, Share2, Terminal, Code2, Bug, FileCode, Braces } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTheme } from "@/contexts/ThemeContext";

interface StatusBarProps {
  isConnected: boolean;
  branch: string;
  commit: string;
  pullRequests: number;
  language?: string;
  onNotificationClick?: () => void;
  onSettingsClick?: () => void;
  onShareClick?: () => void;
  onTerminalClick?: () => void;
  onProblemsClick?: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  isConnected,
  branch,
  commit,
  pullRequests,
  language = "javascript",
  onNotificationClick,
  onSettingsClick,
  onShareClick,
  onTerminalClick,
  onProblemsClick,
}) => {
  const { theme } = useTheme();
  const [notifications, setNotifications] = React.useState(3);

  const getLanguageIcon = () => {
    switch (language) {
      case 'python':
        return <Braces className="h-3 w-3" />;
      case 'javascript':
        return <FileCode className="h-3 w-3" />;
      case 'typescript':
        return <FileCode className="h-3 w-3" />;
      case 'c':
        return <Braces className="h-3 w-3" />;
      case 'cpp':
        return <Braces className="h-3 w-3" />;
      case 'java':
        return <FileCode className="h-3 w-3" />;
      default:
        return <Code2 className="h-3 w-3" />;
    }
  };

  return (
    <div className={`h-6 ${theme === 'dark' ? 'bg-gray-800/40' : 'bg-white/80'} backdrop-blur-sm border-t ${theme === 'dark' ? 'border-gray-700/30' : 'border-gray-200/50'} flex items-center justify-between px-4 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
      <div className="flex items-center space-x-4">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={`flex items-center space-x-1 cursor-pointer ${theme === 'dark' ? 'hover:text-gray-300' : 'hover:text-gray-900'} transition-colors`}>
                {isConnected ? (
                  <Wifi className={`h-3 w-3 ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-500'}`} />
                ) : (
                  <WifiOff className={`h-3 w-3 ${theme === 'dark' ? 'text-red-400' : 'text-red-500'}`} />
                )}
                <span>{isConnected ? "Connected" : "Disconnected"}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent className={`${theme === 'dark' ? 'bg-gray-800/95 border-gray-700/30' : 'bg-white/95 border-gray-200/50'} backdrop-blur-sm`}>
              <p>Connection Status</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={`flex items-center space-x-1 cursor-pointer ${theme === 'dark' ? 'hover:text-gray-300' : 'hover:text-gray-900'} transition-colors`}>
                <GitBranch className={`h-3 w-3 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-500'}`} />
                <span>{branch}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent className={`${theme === 'dark' ? 'bg-gray-800/95 border-gray-700/30' : 'bg-white/95 border-gray-200/50'} backdrop-blur-sm`}>
              <p>Current Branch</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={`flex items-center space-x-1 cursor-pointer ${theme === 'dark' ? 'hover:text-gray-300' : 'hover:text-gray-900'} transition-colors`}>
                <GitCommit className={`h-3 w-3 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-500'}`} />
                <span>{commit.slice(0, 7)}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent className={`${theme === 'dark' ? 'bg-gray-800/95 border-gray-700/30' : 'bg-white/95 border-gray-200/50'} backdrop-blur-sm`}>
              <p>Current Commit</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {pullRequests > 0 && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={`flex items-center space-x-1 cursor-pointer ${theme === 'dark' ? 'hover:text-gray-300' : 'hover:text-gray-900'} transition-colors ${theme === 'dark' ? 'text-blue-400' : 'text-blue-500'}`}>
                  <GitPullRequest className="h-3 w-3" />
                  <span>{pullRequests} PRs</span>
                </div>
              </TooltipTrigger>
              <TooltipContent className={`${theme === 'dark' ? 'bg-gray-800/95 border-gray-700/30' : 'bg-white/95 border-gray-200/50'} backdrop-blur-sm`}>
                <p>Open Pull Requests</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <div className="flex items-center space-x-4">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`h-4 w-4 p-0 ${theme === 'dark' ? 'hover:bg-gray-700/50 hover:text-gray-300' : 'hover:bg-gray-100/80 hover:text-gray-900'}`}
                onClick={onNotificationClick}
              >
                <Bell className="h-3 w-3" />
                {notifications > 0 && (
                  <span className={`absolute -top-1 -right-1 h-3 w-3 ${theme === 'dark' ? 'bg-red-500/80' : 'bg-red-500'} text-white text-[10px] rounded-full flex items-center justify-center`}>
                    {notifications}
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent className={`${theme === 'dark' ? 'bg-gray-800/95 border-gray-700/30' : 'bg-white/95 border-gray-200/50'} backdrop-blur-sm`}>
              <p>Notifications</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`h-4 w-4 p-0 ${theme === 'dark' ? 'hover:bg-gray-700/50 hover:text-gray-300' : 'hover:bg-gray-100/80 hover:text-gray-900'}`}
                onClick={onTerminalClick}
              >
                <Terminal className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className={`${theme === 'dark' ? 'bg-gray-800/95 border-gray-700/30' : 'bg-white/95 border-gray-200/50'} backdrop-blur-sm`}>
              <p>Terminal</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`h-4 w-4 p-0 ${theme === 'dark' ? 'hover:bg-gray-700/50 hover:text-gray-300' : 'hover:bg-gray-100/80 hover:text-gray-900'}`}
                onClick={onProblemsClick}
              >
                <Bug className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className={`${theme === 'dark' ? 'bg-gray-800/95 border-gray-700/30' : 'bg-white/95 border-gray-200/50'} backdrop-blur-sm`}>
              <p>Problems</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`h-4 w-4 p-0 ${theme === 'dark' ? 'hover:bg-gray-700/50 hover:text-gray-300' : 'hover:bg-gray-100/80 hover:text-gray-900'}`}
                onClick={onShareClick}
              >
                <Share2 className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className={`${theme === 'dark' ? 'bg-gray-800/95 border-gray-700/30' : 'bg-white/95 border-gray-200/50'} backdrop-blur-sm`}>
              <p>Share</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`h-4 w-4 p-0 ${theme === 'dark' ? 'hover:bg-gray-700/50 hover:text-gray-300' : 'hover:bg-gray-100/80 hover:text-gray-900'}`}
                onClick={onSettingsClick}
              >
                <Settings className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className={`${theme === 'dark' ? 'bg-gray-800/95 border-gray-700/30' : 'bg-white/95 border-gray-200/50'} backdrop-blur-sm`}>
              <p>Settings</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className={`flex items-center space-x-2 border-l ${theme === 'dark' ? 'border-gray-700/30' : 'border-gray-200/50'} pl-4 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>
          <span>UTF-8</span>
          <div className="flex items-center">
            {getLanguageIcon()}
            <span className="ml-1 capitalize">{language}</span>
          </div>
          <span>Spaces: 2</span>
          <span>Line: 1, Col: 1</span>
        </div>
      </div>
    </div>
  );
}; 
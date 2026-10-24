import React, { useState } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTheme } from "@/contexts/ThemeContext";
import { FileCode, Braces, Terminal, Clock, Server, AlertCircle, Check } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface OutputPanelProps {
  output: string;
  isCompiling: boolean;
  language?: string;
  error?: string | null;
  executionTime?: number | null;
  memoryUsed?: number | null;
  stdin?: string;
  onStdinChange?: (value: string) => void;
  onRun?: () => void;
}

const OutputPanel: React.FC<OutputPanelProps> = ({ 
  output, 
  isCompiling, 
  language = "javascript",
  error = null,
  executionTime = null,
  memoryUsed = null,
  stdin = "",
  onStdinChange = () => {},
  onRun = () => {}
}) => {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<string>("output");

  const getLanguageIcon = () => {
    switch (language) {
      case 'python':
        return <Braces className="h-4 w-4" />;
      case 'javascript':
      case 'typescript':
        return <FileCode className="h-4 w-4" />;
      case 'c':
      case 'cpp':
        return <Braces className="h-4 w-4" />;
      case 'java':
        return <FileCode className="h-4 w-4" />;
      default:
        return <FileCode className="h-4 w-4" />;
    }
  };

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

  return (
    <div className={`h-full ${theme === 'dark' ? 'bg-gray-900/40' : 'bg-white/90'} rounded-lg`}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        <div className="px-4 pt-4 border-b border-gray-200 dark:border-gray-700">
          <TabsList className="grid grid-cols-3 h-9">
            <TabsTrigger 
              value="output" 
              className="flex items-center space-x-2 text-xs"
            >
              <Terminal className="h-3.5 w-3.5" />
              <span>Output</span>
            </TabsTrigger>
            <TabsTrigger 
              value="input" 
              className="flex items-center space-x-2 text-xs"
            >
              <Terminal className="h-3.5 w-3.5" />
              <span>Input</span>
            </TabsTrigger>
            <TabsTrigger 
              value="stats" 
              className="flex items-center space-x-2 text-xs"
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Execution Stats</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="output" className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4">
              {isCompiling ? (
                <div className={`flex items-center space-x-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                  <span>Running {language}...</span>
                </div>
              ) : output ? (
                <>
                  <div className={`flex items-center justify-between mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} text-xs`}>
                    <div className="flex items-center">
                      {getLanguageIcon()}
                      <span className="ml-1 capitalize">{language} output:</span>
                    </div>
                    {error ? (
                      <div className="flex items-center text-red-500">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        <span>Execution Error</span>
                      </div>
                    ) : (
                      <div className="flex items-center text-green-500">
                        <Check className="h-4 w-4 mr-1" />
                        <span>Success</span>
                      </div>
                    )}
                  </div>
                  <pre className={`font-mono text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-800'} p-3 rounded-md ${theme === 'dark' ? 'bg-black/30' : 'bg-gray-100/80'} overflow-auto`}>
                    {output}
                  </pre>
                  {error && (
                    <div className="mt-4">
                      <div className={`flex items-center mb-2 text-red-500 text-xs`}>
                        <AlertCircle className="h-4 w-4 mr-1" />
                        <span>Error details:</span>
                      </div>
                      <pre className={`font-mono text-sm text-red-500 p-3 rounded-md ${theme === 'dark' ? 'bg-red-950/30' : 'bg-red-50'} overflow-auto`}>
                        {error}
                      </pre>
                    </div>
                  )}
                </>
              ) : (
                <div className={`text-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  <div className="flex flex-col items-center gap-2">
                    {getLanguageIcon()}
                    <p>No output yet. Click the play button to run your code.</p>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="input" className="flex-1 overflow-hidden">
          <div className="p-4 h-full flex flex-col">
            <div className={`text-xs mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} flex items-center`}>
              <Terminal className="h-3.5 w-3.5 mr-1" />
              <span>Standard Input (stdin)</span>
            </div>
            <Textarea 
              value={stdin}
              onChange={(e) => onStdinChange(e.target.value)}
              placeholder="Enter input for your program here..."
              className={`flex-1 font-mono text-sm ${theme === 'dark' ? 'bg-black/30 text-gray-300' : 'bg-gray-100/80 text-gray-800'} resize-none mb-3`}
            />
            <Button 
              onClick={onRun}
              disabled={isCompiling} 
              className="self-end"
              size="sm"
            >
              {isCompiling ? 'Running...' : 'Run with this input'}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="stats" className="flex-1 overflow-hidden">
          <div className="p-4">
            <div className={`grid grid-cols-2 gap-4 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-800'}`}>
              <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-black/30' : 'bg-gray-100/80'}`}>
                <div className="flex items-center mb-2">
                  <Clock className="h-4 w-4 mr-2 text-blue-500" />
                  <h3 className="font-medium">Execution Time</h3>
                </div>
                <p className="text-2xl font-mono">{formatTime(executionTime)}</p>
              </div>
              
              <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-black/30' : 'bg-gray-100/80'}`}>
                <div className="flex items-center mb-2">
                  <Server className="h-4 w-4 mr-2 text-purple-500" />
                  <h3 className="font-medium">Memory Used</h3>
                </div>
                <p className="text-2xl font-mono">{formatMemory(memoryUsed)}</p>
              </div>

              <div className={`p-4 rounded-lg col-span-2 ${theme === 'dark' ? 'bg-black/30' : 'bg-gray-100/80'}`}>
                <div className="flex items-center mb-2">
                  <FileCode className="h-4 w-4 mr-2 text-green-500" />
                  <h3 className="font-medium">Language</h3>
                </div>
                <div className="flex items-center">
                  {getLanguageIcon()}
                  <p className="ml-2 capitalize font-mono">{language}</p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OutputPanel;
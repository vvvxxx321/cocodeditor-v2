import React from "react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { X, FileText, FileCode, FileJson, FileType, MoreVertical, Plus, FolderPlus } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const getFileIcon = (fileName: string) => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
      return <FileCode className="h-4 w-4" />;
    case 'json':
      return <FileJson className="h-4 w-4" />;
    case 'txt':
      return <FileText className="h-4 w-4" />;
    default:
      return <FileType className="h-4 w-4" />;
  }
};

export const FileTabs = ({
  files,
  activeFile,
  onFileChange,
  onNewFile,
  onNewFolder,
}: {
  files: string[];
  activeFile: string;
  onFileChange: (file: string) => void;
  onNewFile?: () => void;
  onNewFolder?: () => void;
}) => {
  return (
    <div className="flex items-center bg-white border-b px-2">
      <div className="flex items-center space-x-1 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
        {files.map((file) => (
          <div
            key={file}
            className={`flex items-center space-x-1 px-3 py-2 rounded-t-lg border-b-2 transition-colors ${
              activeFile === file
                ? "bg-blue-50 border-blue-500 text-blue-700"
                : "border-transparent hover:bg-gray-50"
            }`}
          >
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 hover:bg-transparent"
              onClick={() => onFileChange(file)}
            >
              <div className="flex items-center space-x-1">
                {getFileIcon(file)}
                <span className="text-sm">{file}</span>
              </div>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-transparent"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="text-sm">
                  <FileText className="h-4 w-4 mr-2" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem className="text-sm text-red-600">
                  <X className="h-4 w-4 mr-2" />
                  Close
                </DropdownMenuItem>
                <DropdownMenuItem className="text-sm text-red-600">
                  <X className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>
      <Separator orientation="vertical" className="h-6 mx-2" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 px-2">
            <Plus className="h-4 w-4 mr-2" />
            New
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem 
            className="text-sm"
            onClick={onNewFile}
          >
            <FileCode className="h-4 w-4 mr-2" />
            New File
          </DropdownMenuItem>
          <DropdownMenuItem 
            className="text-sm"
            onClick={onNewFolder}
          >
            <FolderPlus className="h-4 w-4 mr-2" />
            New Folder
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
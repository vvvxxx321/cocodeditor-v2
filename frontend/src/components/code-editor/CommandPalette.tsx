import React from "react";
import { Command } from "cmdk";
import { Search, File, Folder, Settings, GitBranch, Share2, Save } from "lucide-react";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCommand: (command: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onOpenChange,
  onCommand,
}) => {
  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command Menu"
    >
      <div className="fixed inset-0 bg-black/30" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Command className="w-full max-w-2xl rounded-lg bg-white shadow-lg">
          <div className="flex items-center border-b px-3">
            <Search className="h-5 w-5 text-gray-500" />
            <Command.Input
              placeholder="Type a command or search..."
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-gray-500 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <Command.List className="max-h-[300px] overflow-y-auto overflow-x-hidden p-2">
            <Command.Group heading="File">
              <Command.Item
                onSelect={() => onCommand("newFile")}
                className="flex items-center space-x-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-gray-100 cursor-pointer"
              >
                <File className="h-4 w-4" />
                <span>New File</span>
              </Command.Item>
              <Command.Item
                onSelect={() => onCommand("newFolder")}
                className="flex items-center space-x-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-gray-100 cursor-pointer"
              >
                <Folder className="h-4 w-4" />
                <span>New Folder</span>
              </Command.Item>
              <Command.Item
                onSelect={() => onCommand("save")}
                className="flex items-center space-x-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-gray-100 cursor-pointer"
              >
                <Save className="h-4 w-4" />
                <span>Save</span>
              </Command.Item>
            </Command.Group>
            <Command.Group heading="Git">
              <Command.Item
                onSelect={() => onCommand("gitBranch")}
                className="flex items-center space-x-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-gray-100 cursor-pointer"
              >
                <GitBranch className="h-4 w-4" />
                <span>Git: Checkout Branch</span>
              </Command.Item>
            </Command.Group>
            <Command.Group heading="Collaboration">
              <Command.Item
                onSelect={() => onCommand("share")}
                className="flex items-center space-x-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-gray-100 cursor-pointer"
              >
                <Share2 className="h-4 w-4" />
                <span>Share</span>
              </Command.Item>
            </Command.Group>
            <Command.Group heading="Settings">
              <Command.Item
                onSelect={() => onCommand("settings")}
                className="flex items-center space-x-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-gray-100 cursor-pointer"
              >
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </Command.Dialog>
  );
}; 
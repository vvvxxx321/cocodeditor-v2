import * as React from "react"
import { ChevronRight, ChevronDown, File, Folder } from "lucide-react"
import { cn } from "@/lib/utils"

interface FileItem {
  id: string
  name: string
  type: "file" | "folder"
  icon?: React.ComponentType<{ className?: string }>
  children?: FileItem[]
}

interface FileExplorerProps {
  files: FileItem[]
  onFileSelect?: (file: FileItem) => void
  onFolderSelect?: (folder: FileItem) => void
  selectedFolderId?: string
}

export function FileExplorer({ 
  files, 
  onFileSelect, 
  onFolderSelect,
  selectedFolderId 
}: FileExplorerProps) {
  const [expandedFolders, setExpandedFolders] = React.useState<Set<string>>(new Set())
  const [selectedFile, setSelectedFile] = React.useState<string | null>(null)

  // Automatically expand the selected folder
  React.useEffect(() => {
    if (selectedFolderId) {
      setExpandedFolders(prev => {
        const next = new Set(prev);
        next.add(selectedFolderId);
        return next;
      });
    }
  }, [selectedFolderId]);

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(folderId)) {
        next.delete(folderId)
      } else {
        next.add(folderId)
      }
      return next
    })
  }

  const renderFileItem = (item: FileItem, level = 0) => {
    const isFolder = item.type === "folder"
    const isExpanded = expandedFolders.has(item.id)
    const isSelected = isFolder ? selectedFolderId === item.id : selectedFile === item.id
    const Icon = item.icon || (isFolder ? Folder : File)

    return (
      <div key={item.id}>
        <div
          className={cn(
            "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm cursor-pointer",
            "hover:bg-accent hover:text-accent-foreground",
            "transition-colors",
            isSelected && "bg-accent text-accent-foreground"
          )}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => {
            if (isFolder) {
              toggleFolder(item.id)
              onFolderSelect?.(item)
            } else {
              setSelectedFile(item.id)
              onFileSelect?.(item)
            }
          }}
        >
          {isFolder && (
            <ChevronRight
              className={cn(
                "h-4 w-4 transition-transform",
                isExpanded && "rotate-90"
              )}
            />
          )}
          <Icon className="h-4 w-4" />
          <span className="truncate">{item.name}</span>
        </div>
        {isFolder && isExpanded && item.children && (
          <div>
            {item.children.map((child) => renderFileItem(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  return <div className="py-1">{files.map((file) => renderFileItem(file))}</div>
} 
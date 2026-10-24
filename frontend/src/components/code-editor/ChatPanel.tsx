import React, { useState, useEffect, useRef, memo } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Send, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import socket from "@/config/socket"; // Import your configured socket instance

// Define the Collaborator interface (ensure it matches what's passed in)
interface Collaborator {
  id: string;
  name: string;
  status: "online" | "offline" | "busy";
  email?: string;
  avatar?: string;
}

// Define the Message interface (ensure it matches backend structure)
interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  timestamp: Date; // Use Date object
  type: "text" | "file";
  fileName?: string;
  fileUrl?: string;
}

interface ChatPanelProps {
  collaborator: Collaborator;
  onClose: () => void;
  currentUserId: string;
}

// --- WRAP COMPONENT DEFINITION ---
const ChatPanelComponent: React.FC<ChatPanelProps> = ({
  collaborator,
  onClose,
  currentUserId,
}) => {
  const { theme } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false); // User's own typing state
  const [recipientIsTyping, setRecipientIsTyping] = useState(false); // Collaborator's typing state
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Ref for typing timeout

  // --- Real-time Socket Logic ---
  useEffect(() => {
    // Log dependency values when effect runs
    console.log(`[ChatPanel EFFECT] Running. Deps: collabId=${collaborator?.id}, currentUserId=${currentUserId}, socketId=${socket?.id}`);

    if (!socket || !collaborator?.id || !currentUserId) { 
        console.log(`[ChatPanel EFFECT] Skipping setup: Missing critical data.`);
        return; 
    } 
    
    const currentCollaboratorId = collaborator.id; // Capture ID for cleanup closure

    socket.emit("joinChat", { recipientId: currentCollaboratorId });
    console.log(`[ChatPanel EFFECT] Emitted joinChat for ${currentCollaboratorId}. Setting up listeners...`);

    const handleChatHistory = (chatHistory: any[]) => { 
        console.log(`[ChatPanel Listener] Received chatHistory for ${currentCollaboratorId}`);
        const parsedMessages = chatHistory.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        setMessages(parsedMessages);
        scrollToBottom();
    };

    // --- RESTORE ORIGINAL HANDLER START ---
    const handleNewMessage = (message: any) => {
        console.log(`[ChatPanel Listener] Received newMessage EVENT. Current chat is with ${currentCollaboratorId}`, message);
        // Log IDs for checking the condition
        console.log(`  Checking condition: msgSender=${message?.senderId}, msgRecipient=${message?.recipientId}, currentUserId=${currentUserId}, collaboratorId=${collaborator.id}`);

        // Check if the message belongs to this specific chat
        const belongsToThisChat = (message.senderId === currentUserId && message.recipientId === collaborator.id) || 
                                  (message.senderId === collaborator.id && message.recipientId === currentUserId);

        console.log(`  Belongs to this chat? ${belongsToThisChat}`);

        if (belongsToThisChat) {
            let parsedMessage;
            try {
              parsedMessage = {
                  ...message,
                  timestamp: new Date(message.timestamp) // Attempt to parse timestamp
              };
              console.log(`  Parsed message:`, parsedMessage);
            } catch (e) {
              console.error("Error parsing timestamp:", e, "Original message:", message);
              return; // Don't proceed if timestamp parsing fails
            }
            
            setMessages(prev => {
               // Log state update
               console.log("  Updating messages state. Prev Length:", prev.length);
               const newState = [...prev, parsedMessage];
               console.log("  New State Length:", newState.length);
               return newState;
            });
            
            if (message.senderId === collaborator.id) {
                setRecipientIsTyping(false);
            }
            scrollToBottom();
        } else {
          console.log("  Message ignored (not for this chat).");
        }
    };
    // --- RESTORE ORIGINAL HANDLER END ---

    const handleUserTyping = ({ userId, isTyping: typingStatus }: { userId: string, isTyping: boolean }) => {
        // Check against the ID captured when the listener was set up
        if (userId === currentCollaboratorId) { 
          setRecipientIsTyping(typingStatus);
        }
    };

    // Setup listeners
    socket.on("chatHistory", handleChatHistory);
    console.log(`[ChatPanel EFFECT] Attaching 'newMessage' listener for collabId ${currentCollaboratorId}. Socket ID: ${socket.id}`);
    // --- REVERT LISTENER ATTACHMENT ---
    socket.on("newMessage", handleNewMessage);
    // --- REVERT LISTENER ATTACHMENT ---
    socket.on("userTyping", handleUserTyping);

    // Cleanup function
    return () => {
      // Log details during cleanup
      console.log(`[ChatPanel CLEANUP] Cleaning up for collabId: ${currentCollaboratorId}. Current Socket ID: ${socket?.id}. Socket Connected: ${socket?.connected}`);
      // Only emit leaveChat if the socket seems connected
      if (socket?.connected) { 
          socket.emit("leaveChat", { recipientId: currentCollaboratorId });
      }
      // Remove THESE specific listeners
      socket.off("chatHistory", handleChatHistory);
      console.log(`[ChatPanel CLEANUP] Detaching 'newMessage' listener for collabId ${currentCollaboratorId}. Socket ID: ${socket?.id}`);
      // --- REVERT LISTENER DETACHMENT ---
      socket.off("newMessage", handleNewMessage);
      // --- REVERT LISTENER DETACHMENT ---
      socket.off("userTyping", handleUserTyping);
      if (typingTimeoutRef.current) {
         clearTimeout(typingTimeoutRef.current);
      }
    };
  // IMPORTANT: Keep dependencies simple and stable primitives
  }, [collaborator.id, currentUserId]);

  // --- Scroll to bottom helper ---
  const scrollToBottom = () => {
    setTimeout(() => { // Timeout helps ensure DOM is updated before scrolling
        if (scrollAreaRef.current) {
            // Get the scrollable element (might be the first child of ScrollArea viewport)
            const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (viewport) {
                viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
            }
        }
    }, 100);
  };

  // Scroll when messages change
  useEffect(() => {
     scrollToBottom();
  }, [messages]);

  // --- Sending Messages ---
  const handleSendMessage = () => {
    if (!newMessage.trim() || !socket || !currentUserId) return;

    const messageData = {
      senderId: currentUserId,
      recipientId: collaborator.id,
      content: newMessage,
      type: "text" as const
    };

    console.log(`[ChatPanel] Emitting sendMessage:`, messageData);
    socket.emit("sendMessage", messageData);
    setNewMessage("");
    handleTypingStop();
  };

  // --- Typing Indicator Logic ---
  const handleTypingStop = () => {
    if (isTyping && socket) {
      setIsTyping(false);
      socket.emit("typing", { recipientId: collaborator.id, isTyping: false });
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);

    // Emit typing start if not already typing
    if (!isTyping && socket) {
      setIsTyping(true);
      socket.emit("typing", { recipientId: collaborator.id, isTyping: true });
    }

    // Reset typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(handleTypingStop, 2000); // Stop after 2s inactivity
  };


  // --- File Upload (Placeholder) ---
  const handleFileUpload = () => {
    // TODO: Implement file upload functionality
    // - Open file picker
    // - Upload file to storage (e.g., Supabase Storage)
    // - Get file URL and name
    // - Emit 'sendMessage' with type: 'file', fileName, fileUrl
    console.log("File upload clicked - placeholder");
  };

  // --- JSX Rendering (Restore the full structure) ---
  return (
    <div className={`flex flex-col h-full ${
      theme === 'dark' ? 'bg-gray-800/50 border-gray-700/30' : 'bg-white border-gray-200'
    } border-l`}>
      {/* Chat Header */}
      <div className={`flex items-center justify-between p-4 border-b ${
        theme === 'dark' ? 'border-gray-700/30' : 'border-gray-200'
      }`}>
        <div className="flex items-center space-x-2">
           <div className="relative">
            {collaborator.avatar ? (
              <img
                src={collaborator.avatar}
                alt={collaborator.name}
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <div className={`w-8 h-8 rounded-full ${
                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
              } flex items-center justify-center`}>
                <span className={`text-sm ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                }`}>
                  {collaborator.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 ${
              theme === 'dark' ? 'border-gray-800' : 'border-white'
            } ${
              collaborator.status === "online"
                ? "bg-green-500"
                : collaborator.status === "busy"
                ? "bg-yellow-500"
                : "bg-gray-400"
            }`} />
          </div>
          <div>
            <h3 className={`font-medium ${
              theme === 'dark' ? 'text-gray-200' : 'text-gray-900'
            }`}>
              {collaborator.name}
            </h3>
            <p className={`text-sm ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            }`}>
              {recipientIsTyping ? "Typing..." : collaborator.status === "online" ? "Online" : collaborator.status === "busy" ? "Busy" : "Offline"}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className={cn("h-8 w-8", theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100')}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.senderId === currentUserId ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[70%] rounded-lg p-3 ${
                  message.senderId === currentUserId
                    ? theme === 'dark'
                      ? "bg-blue-600 text-white"
                      : "bg-blue-500 text-white"
                    : theme === 'dark'
                    ? "bg-gray-700/50 text-gray-200"
                    : "bg-gray-100 text-gray-900"
                }`}
              >
                {message.type === "text" ? (
                  <p>{message.content}</p>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Paperclip className="h-4 w-4" />
                    <a
                      href={message.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-blue-300"
                    >
                      {message.fileName || 'Attached File'}
                    </a>
                  </div>
                )}
                <span className={`text-xs mt-1 block opacity-70 ${
                   message.senderId === currentUserId ? (theme === 'dark' ? 'text-blue-200' : 'text-blue-100') : (theme === 'dark' ? 'text-gray-400' : 'text-gray-500')
                }`}>
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
          {/* Empty div ref is managed by ScrollArea now */}
        </div>
      </ScrollArea>

      {/* Message Input */}
      <div className={`p-4 border-t ${
        theme === 'dark' ? 'border-gray-700/30' : 'border-gray-200'
      }`}>
        <div className="flex space-x-2">
          <Button variant="ghost" size="icon" onClick={handleFileUpload} className={cn("h-8 w-8", theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100')}>
            <Paperclip className="h-4 w-4" />
          </Button>
          <Input
            value={newMessage}
            onChange={handleInputChange}
            onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
            placeholder="Type a message..."
            className={cn("flex-1", theme === 'dark' ? 'bg-gray-700/50' : 'bg-white')}
            autoComplete="off"
          />
          <Button onClick={handleSendMessage} size="icon" className={cn("h-8 w-8", theme === 'dark' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600')}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div> // Closing div for the main component wrapper
  ); // Closing parenthesis for return
};

// --- EXPORT MEMOIZED VERSION ---
export const ChatPanel = memo(ChatPanelComponent);
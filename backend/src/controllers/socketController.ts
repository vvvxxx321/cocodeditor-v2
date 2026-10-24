import { Server, Socket } from "socket.io";
import { fileService } from '../services/fileService';
import { projectService } from '../services/projectService';
import { verifyAccessToken } from '../auth/verifyToken';
import { can, getProjectAccess, Action } from '../auth/rbac';
import { createChatStore } from '../services/chatStore';
import type Redis from 'ioredis';
import { logger as baseLogger } from '../logger';

const logger = baseLogger.child({ component: 'socket' });

// V2 (multi-instance): V1 kept onlineUsers / projectMembers / chat history in per-process Maps,
// which are wrong as soon as there is more than one API instance. Presence is now derived from
// adapter-aware room membership (io.in(room).fetchSockets() queries every instance through the
// Redis adapter), and chat history lives in Redis (services/chatStore.ts).

// NEW: Helper function to generate a unique chat room ID for two users
const getChatRoomId = (user1: string, user2: string): string => {
  // Sort IDs to ensure consistency regardless of who initiates the chat
  return [user1, user2].sort().join('_');
};

// Convert DB files to the payload expected by the frontend (V2 adds the file id).
const toFilePayload = (files: { id: string; name: string; content: string | null }[]) =>
  files.map(file => ({ id: file.id, path: file.name, content: file.content || '' }));

export const setupSocketHandlers = (io: Server, opts: { redis?: Redis | null } = {}) => {
  const chatStore = createChatStore(opts.redis);
  const userRoom = (userId: string) => `user:${userId}`;

  // V2: authenticate every socket at handshake time. The user id comes from the verified
  // Supabase JWT, never from event payloads (V1 trusted client-supplied userId/senderId).
  io.use(async (socket, next) => {
    try {
      const user = await verifyAccessToken(socket.handshake.auth?.token);
      socket.data.userId = user.id;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  // Resolves the caller's project role and checks the action; emits an error on denial.
  const authorizeProject = async (socket: Socket, projectId: string, action: Action) => {
    const access = await getProjectAccess(socket.data.userId, projectId);
    if (!access || !can(access.role, action)) {
      socket.emit("error", { message: "Forbidden", projectId });
      return false;
    }
    return true;
  };

  io.on("connection", (socket: Socket) => {
    const authUserId: string = socket.data.userId;
    // Every socket of a user joins user:<id>; presence = "does that room have any socket on any instance".
    socket.join(userRoom(authUserId));
    const joinedProjects = new Set<string>();

    // Presence handler (payload userId is ignored; identity comes from the handshake)
    socket.on("userAuthenticated", () => {
      const userId = authUserId;
      
      
      // Broadcast to all clients the list of online users
      broadcastUserStatus(io, userId, "online");
    });
    
    // Join a project room
    socket.on("joinProject", async ({ projectId }: { projectId: string }) => {
      const userId = authUserId;
      if (!projectId) {
        logger.error("[ERROR] joinProject called without projectId");
        return;
      }
      if (!(await authorizeProject(socket, projectId, 'read'))) return;
      
      logger.debug(`[DEBUG] User ${userId} joining project ${projectId}, socket ID: ${socket.id}`);
      
      // Add to project room
      const roomName = `project:${projectId}`;
      socket.join(roomName);
      logger.debug(`[DEBUG] Socket ${socket.id} joined room ${roomName}`);
      logger.debug({ detail: Array.from(socket.rooms) }, `[DEBUG] Socket ${socket.id} rooms:`);
      
      // Broadcast updated user list to project room
      joinedProjects.add(projectId);
      await broadcastProjectUsers(io, projectId).catch(err => logger.error({ err }, '[SocketCtrl] presence failed'));
      
      // Load project files from database and send to user
      try {
        logger.debug(`[DEBUG] Loading files for project ${projectId} from database...`);
        const files = await fileService.getProjectFiles(projectId);
        
        logger.debug(`[DEBUG] Loaded ${files.length} files for project ${projectId}`);
        
        const fileData = toFilePayload(files);

        if (files.length === 0) {
          logger.debug(`[DEBUG] No files found for project ${projectId}. This might be a new project.`);
        } else {
          // Log some file details for debugging
          files.slice(0, 5).forEach(file => {
            logger.debug(`[DEBUG] - File: ${file.name}, id: ${file.id}, content length: ${file.content?.length || 0}`);
          });
        }
        
        // Send files to the user who just joined
        logger.debug(`[DEBUG] Sending filesUpdate to socket ${socket.id} with ${fileData.length} files`);
        socket.emit("filesUpdate", { files: fileData });
      } catch (error) {
        logger.error({ err: error }, `[ERROR] Failed to load project files for ${projectId}:`);
        // Send an error message to the client
        socket.emit("error", { message: "Failed to load project files" });
      }
    });
    
    // Leave a project room - only happens when explicitly navigating away
    socket.on("leaveProject", ({ projectId }: { projectId: string }) => {
      const userId = authUserId;
      if (userId) {
        logger.debug(`User ${userId} leaving project ${projectId}, but will remain online`);
        socket.leave(`project:${projectId}`);
        joinedProjects.delete(projectId);
        broadcastProjectUsers(io, projectId).catch(err => logger.error({ err }, '[SocketCtrl] presence failed'));
        
        // Note: We do NOT remove the user from onlineUsers here
        // as they are still logged in, just not viewing this project
      }
    });

    // V2: the V1 "codeChange" event (full-document broadcast + DB write on every keystroke,
    // last-writer-wins) was removed. Document content is synchronized by Yjs over Hocuspocus
    // (src/collab), which is the single writer of File.content.

    // NEW: Handle file creation
    socket.on("createFile", async (data: { projectId: string, filename: string, content: string }) => {
      // Validate the data structure
      if (!data || !data.projectId || !data.filename) {
        logger.error({ err: data }, "[DEBUG] Invalid createFile data:");
        return;
      }
      if (!(await authorizeProject(socket, data.projectId, 'write'))) return;
      
      logger.debug(`[DEBUG] Creating file ${data.filename} in project ${data.projectId} from socket ${socket.id}`);
      
      // Determine file language based on file extension
      const fileExtension = data.filename.split('.').pop() || '';
      const language = getLanguageFromExtension(fileExtension);
      
      try {
        // Create file in database
        const file = await fileService.upsertFile(
          data.projectId,
          data.filename,
          data.content || '',
          language
        );
        
        logger.debug(`[DEBUG] File created in database: ${file.id}, name: ${file.name}`);
        
        // Get all sockets in the project room
        const roomName = `project:${data.projectId}`;
        const sockets = io.sockets.adapter.rooms.get(roomName);
        logger.debug(`[DEBUG] Room ${roomName} has ${sockets ? sockets.size : 0} connected sockets`);
        
        // Broadcast to all users in the project room
        logger.debug(`[DEBUG] Broadcasting fileCreated to room ${roomName}`);
        io.to(roomName).emit("fileCreated", {
          id: file.id,
          path: data.filename,
          content: data.content || ''
        });
        
        // Also broadcast updated file list with a slight delay to ensure sequential processing
        setTimeout(async () => {
          const files = await fileService.getProjectFiles(data.projectId);
          logger.debug(`[DEBUG] Retrieved ${files.length} files for broadcasting filesUpdate`);
          
          const fileData = toFilePayload(files);

          logger.debug(`[DEBUG] Broadcasting filesUpdate to room ${roomName} with ${fileData.length} files`);
          io.to(roomName).emit("filesUpdate", { files: fileData });
        }, 100);
      } catch (error) {
        logger.error({ err: error }, `Error creating file ${data.filename}:`);
      }
    });
    
    // NEW: Handle folder creation
    socket.on("createFolder", async (data: { projectId: string, folderName: string }) => {
      // Validate
      if (!data || !data.projectId || !data.folderName) {
        logger.error({ err: data }, "Invalid createFolder data:");
        return;
      }
      if (!(await authorizeProject(socket, data.projectId, 'write'))) return;
      
      logger.debug(`Creating folder ${data.folderName} in project ${data.projectId}`);
      
      try {
        // For folders, we'll create a placeholder file to represent the folder
        const placeholderPath = `${data.folderName}/.gitkeep`;
        await fileService.upsertFile(
          data.projectId,
          placeholderPath,
          '',
          'text'
        );
        
        // Broadcast to all users in the project room
        const roomName = `project:${data.projectId}`;
        io.to(roomName).emit("folderCreated", {
          path: data.folderName
        });
        
        // Also broadcast updated file list
        const files = await fileService.getProjectFiles(data.projectId);
        const fileData = toFilePayload(files);

        io.to(roomName).emit("filesUpdate", { files: fileData });
      } catch (error) {
        logger.error({ err: error }, `Error creating folder ${data.folderName}:`);
      }
    });

    // === CHAT HANDLERS ===

    // Join a direct message chat room
    socket.on("joinChat", async ({ recipientId }: { recipientId: string }) => {
      const senderId = authUserId;
      if (!recipientId) return;

      const chatRoomId = getChatRoomId(senderId, recipientId);
      logger.debug(`[SocketCtrl] Socket ID ${socket.id} (User ${senderId}) joining room: chat:${chatRoomId}`);
      socket.join(`chat:${chatRoomId}`);

      // Send chat history (shared across instances when Redis is configured)
      try {
        socket.emit("chatHistory", await chatStore.history(chatRoomId));
      } catch (error) {
        logger.error({ err: error }, `[SocketCtrl] Failed to load chat history for ${chatRoomId}:`);
        socket.emit("chatHistory", []);
      }
    });

    // Leave a direct message chat room
    socket.on("leaveChat", ({ recipientId }: { recipientId: string }) => {
      const senderId = authUserId;

      const chatRoomId = getChatRoomId(senderId, recipientId);
      logger.debug(`User ${senderId} leaving chat room: ${chatRoomId}`);
      socket.leave(`chat:${chatRoomId}`);
    });

    // Handle sending a new message
    socket.on("sendMessage", async (message: {
      senderId: string;
      recipientId: string;
      content: string;
      type: "text" | "file";
      fileName?: string;
      fileUrl?: string;
    }) => {
      // V2: sender identity comes from the authenticated socket; payload senderId is ignored.
      const senderId = authUserId;
      const { recipientId, content, type, fileName, fileUrl } = message;
      if (!recipientId) return;

      const chatRoomId = getChatRoomId(senderId, recipientId);
      
      const newMessage = {
        id: Date.now().toString(),
        senderId, // from the authenticated socket
        recipientId,
        content,
        timestamp: new Date(),
        type,
        fileName,
        fileUrl
      };
      
      // Store in history (capped at 100 messages)
      try {
        await chatStore.append(chatRoomId, newMessage);
      } catch (error) {
        logger.error({ err: error }, `[SocketCtrl] Failed to store chat message for ${chatRoomId}:`);
      }
      
      // Broadcast to the chat room (reaches sockets on every instance via the adapter)
      io.to(`chat:${chatRoomId}`).emit("newMessage", newMessage);
    });

    // Handle typing indicator
    socket.on("typing", ({ recipientId, isTyping }: { recipientId: string, isTyping: boolean }) => {
        const senderId = authUserId;

        const chatRoomId = getChatRoomId(senderId, recipientId);
        // Broadcast typing status only to the other user in the room
        socket.to(`chat:${chatRoomId}`).emit("userTyping", { userId: senderId, isTyping });
    });

    // Explicit user logout - if implemented in your app
    socket.on("userLogout", () => {
      broadcastUserStatus(io, authUserId, "offline");
    });

    // Handle disconnection (browser close, etc.)
    socket.on("disconnect", async () => {
      const userId = authUserId;
      try {
        // The socket has already left its rooms here; any remaining socket in user:<id>, on any
        // instance, means the user is still online.
        const remaining = await io.in(userRoom(userId)).fetchSockets();
        if (remaining.length === 0) broadcastUserStatus(io, userId, "offline");
        for (const room of joinedProjects) await broadcastProjectUsers(io, room);
      } catch (error) {
        logger.error({ err: error }, `[SocketCtrl] presence update failed for ${userId}:`);
      }
    });
  });
  
  // Helper: Broadcast user status to all connected clients
  function broadcastUserStatus(io: Server, userId: string, status: "online" | "offline" | "idle") {
    // Prepare user status update
    const userStatus = {
      id: userId,
      status
    };
    
    // Broadcast to all connected clients
    io.emit("usersUpdate", [userStatus]);
  }
  
  // Helper: Broadcast the users currently connected to a project (across all instances)
  async function broadcastProjectUsers(io: Server, projectId: string) {
    const roomName = `project:${projectId}`;
    const sockets = await io.in(roomName).fetchSockets();
    const userIds = Array.from(new Set(sockets.map(s => s.data.userId as string)));
    io.to(roomName).emit("projectUsers", userIds.map(id => ({ id, status: "online" })));
  }
  
  // Helper: Get language from file extension
  function getLanguageFromExtension(extension: string): string {
    const extensionMap: {[key: string]: string} = {
      'js': 'javascript',
      'ts': 'typescript',
      'jsx': 'javascript',
      'tsx': 'typescript',
      'py': 'python',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'h': 'c',
      'hpp': 'cpp',
      'cs': 'csharp',
      'go': 'go',
      'rb': 'ruby',
      'php': 'php',
      'html': 'html',
      'css': 'css',
      'md': 'markdown',
      'json': 'json',
      'sql': 'sql',
      'txt': 'text'
    };
    
    return extensionMap[extension.toLowerCase()] || 'text';
  }
};
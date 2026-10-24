import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/providers/auth-context-provider';

export const useSocket = () => {
  const { session } = useAuth();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!session?.access_token) return;

    // Initialize socket connection
    const socket = io('http://localhost:3000', {
      auth: {
        token: session.access_token
      },
      transports: ['websocket']
    });

    socketRef.current = socket;

    // Handle connection events
    socket.on('connect', () => {
      console.log('Connected to socket server');
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from socket server');
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
    };
  }, [session?.access_token]);

  return socketRef.current;
}; 
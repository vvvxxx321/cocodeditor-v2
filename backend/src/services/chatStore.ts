import type Redis from 'ioredis';

export interface ChatMessage {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  timestamp: Date | string;
  type: 'text' | 'file';
  fileName?: string;
  fileUrl?: string;
}

const MAX_HISTORY = 100;

/**
 * Direct-message history. With Redis it is shared by every API instance (a capped list per
 * chat room); without Redis it falls back to process memory (V1 behaviour, single instance only).
 */
export function createChatStore(redis?: Redis | null) {
  const memory = new Map<string, ChatMessage[]>();
  const key = (roomId: string) => `chat:history:${roomId}`;
  return {
    async append(roomId: string, msg: ChatMessage) {
      if (redis) {
        await redis.multi().rpush(key(roomId), JSON.stringify(msg)).ltrim(key(roomId), -MAX_HISTORY, -1).exec();
        return;
      }
      const list = memory.get(roomId) ?? [];
      list.push(msg);
      memory.set(roomId, list.slice(-MAX_HISTORY));
    },
    async history(roomId: string): Promise<ChatMessage[]> {
      if (redis) return (await redis.lrange(key(roomId), 0, -1)).map(s => JSON.parse(s));
      return memory.get(roomId) ?? [];
    },
  };
}

import { Chat, CreateChatRequest, UpdateChatRequest } from '@/types/chat';

// Immutable default chats - these never change
const DEFAULT_CHATS: Readonly<Chat[]> = [
  {
    id: 'default-0',
    title: 'Weather Assistant with Tools',
    lastMessage: 'The current weather in Oakland is 72°F and partly cloudy with light winds.',
    createdAt: '9/2/2025, 2:30:15 PM',
    updatedAt: '9/2/2025, 2:35:45 PM',
    messageCount: 4,
    status: 'active',
    participants: ['user123', 'weather-assistant'],
  },
  {
    id: 'default-1',
    title: 'Customer Support Conversation',
    lastMessage: 'Thank you for your help with the billing issue.',
    createdAt: '9/1/2025, 10:15:30 AM',
    updatedAt: '9/1/2025, 2:45:15 PM',
    messageCount: 12,
    status: 'active',
    participants: ['user123', 'support-agent'],
  },
  {
    id: 'default-2',
    title: 'Project Planning Discussion',
    lastMessage: 'Let\'s schedule the next milestone review for Friday.',
    createdAt: '8/30/2025, 9:20:45 AM',
    updatedAt: '9/1/2025, 11:30:22 AM',
    messageCount: 28,
    status: 'active',
    participants: ['user123', 'project-manager', 'team-lead'],
  },
  {
    id: 'default-3',
    title: 'Technical Documentation Review',
    lastMessage: 'The API documentation looks good to go.',
    createdAt: '8/29/2025, 2:10:12 PM',
    updatedAt: '8/31/2025, 4:20:33 PM',
    messageCount: 15,
    status: 'archived',
    participants: ['user123', 'tech-writer'],
  },
  {
    id: 'default-4',
    title: 'Bug Report Analysis',
    lastMessage: 'Issue has been reproduced and assigned to dev team.',
    createdAt: '8/28/2025, 11:05:18 AM',
    updatedAt: '8/30/2025, 9:15:45 AM',
    messageCount: 8,
    status: 'paused',
    participants: ['user123', 'qa-engineer'],
  },
  {
    id: 'default-5',
    title: 'Feature Request Discussion',
    lastMessage: 'We\'ll add this to the next sprint backlog.',
    createdAt: '8/27/2025, 3:45:22 PM',
    updatedAt: '8/29/2025, 1:12:08 PM',
    messageCount: 22,
    status: 'active',
    participants: ['user123', 'product-manager'],
  },
  {
    id: 'default-6',
    title: 'Training Session Q&A',
    lastMessage: 'Thanks for the comprehensive training materials.',
    createdAt: '8/26/2025, 10:30:15 AM',
    updatedAt: '8/27/2025, 5:45:30 PM',
    messageCount: 35,
    status: 'archived',
    participants: ['user123', 'trainer', 'trainee1', 'trainee2'],
  },
] as const;

class ChatsService {
  private chats: Chat[] = [];
  private nextId = 2000; // Start custom IDs from 2000 to avoid conflicts

  constructor() {
    // Initialize with default chats
    this.createDefaults();
  }

  /**
   * Get all chats
   */
  async getAll(): Promise<Chat[]> {
    // Simulate API delay
    await this.delay(100);
    return [...this.chats]; // Return a copy
  }

  /**
   * Get chat by ID
   */
  async getById(id: string): Promise<Chat | null> {
    await this.delay(50);
    const chat = this.chats.find(c => c.id === id);
    return chat ? { ...chat } : null; // Return a copy
  }

  /**
   * Create a new chat
   */
  async create(request: CreateChatRequest): Promise<Chat> {
    await this.delay(200);
    
    const now = new Date().toLocaleString();
    const newChat: Chat = {
      id: `chat-${this.nextId++}`,
      title: request.title,
      lastMessage: request.lastMessage,
      status: request.status || 'active',
      participants: request.participants || [],
      messageCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.chats.push(newChat);
    return { ...newChat }; // Return a copy
  }

  /**
   * Update an existing chat
   */
  async update(id: string, request: UpdateChatRequest): Promise<Chat | null> {
    await this.delay(200);
    
    const index = this.chats.findIndex(c => c.id === id);
    if (index === -1) return null;

    const updatedChat: Chat = {
      ...this.chats[index],
      ...request,
      updatedAt: new Date().toLocaleString(),
    };

    this.chats[index] = updatedChat;
    return { ...updatedChat }; // Return a copy
  }

  /**
   * Delete a chat by ID
   */
  async delete(id: string): Promise<boolean> {
    await this.delay(150);
    
    const index = this.chats.findIndex(c => c.id === id);
    if (index === -1) return false;

    this.chats.splice(index, 1);
    return true;
  }

  /**
   * Delete all chats
   */
  async deleteAll(): Promise<void> {
    await this.delay(100);
    this.chats = [];
  }

  /**
   * Create default chats (clone from immutable defaults)
   */
  async createDefaults(): Promise<Chat[]> {
    await this.delay(300);
    
    // Clone default chats with new IDs to avoid conflicts
    const clonedDefaults: Chat[] = DEFAULT_CHATS.map((defaultChat, index) => ({
      ...defaultChat,
      id: `cloned-${Date.now()}-${index}`, // Generate unique IDs
      createdAt: new Date().toLocaleString(), // Update creation time
      updatedAt: new Date().toLocaleString(), // Update modification time
    }));

    this.chats = [...clonedDefaults];
    return [...this.chats]; // Return a copy
  }

  /**
   * Get count of chats
   */
  async getCount(): Promise<number> {
    await this.delay(50);
    return this.chats.length;
  }

  /**
   * Search chats by title or last message
   */
  async search(query: string): Promise<Chat[]> {
    await this.delay(100);
    
    if (!query.trim()) return [...this.chats];
    
    const lowercaseQuery = query.toLowerCase();
    const filtered = this.chats.filter(chat => 
      chat.title.toLowerCase().includes(lowercaseQuery) ||
      chat.lastMessage?.toLowerCase().includes(lowercaseQuery)
    );
    
    return filtered.map(chat => ({ ...chat })); // Return copies
  }

  /**
   * Simulate API delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const chatsService = new ChatsService();
export default chatsService;
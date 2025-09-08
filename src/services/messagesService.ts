import { Message, CreateMessageRequest, UpdateMessageRequest } from '@/types/message';

// Immutable default messages for different chats
const DEFAULT_MESSAGES: Record<string, Readonly<Message[]>> = {
  'default-1': [
    {
      id: 'msg-1-1',
      chatId: 'default-1',
      content: 'Hello, I need help with my billing issue. I was charged twice for last month.',
      sender: 'user123',
      timestamp: '9/1/2025, 10:15:30 AM',
      type: 'user',
      status: 'read',
    },
    {
      id: 'msg-1-2',
      chatId: 'default-1',
      content: "I'm sorry to hear about the billing issue. Let me look into your account and help resolve this double charge.",
      sender: 'support-agent',
      timestamp: '9/1/2025, 10:17:45 AM',
      type: 'assistant',
      status: 'read',
    },
    {
      id: 'msg-1-3',
      chatId: 'default-1',
      content: "I can see the duplicate charge on your account. I'll process a refund for the extra charge right away.",
      sender: 'support-agent',
      timestamp: '9/1/2025, 10:22:15 AM',
      type: 'assistant',
      status: 'read',
    },
    {
      id: 'msg-1-4',
      chatId: 'default-1',
      content: 'Thank you for your help with the billing issue.',
      sender: 'user123',
      timestamp: '9/1/2025, 2:45:15 PM',
      type: 'user',
      status: 'read',
    },
  ],
  'default-2': [
    {
      id: 'msg-2-1',
      chatId: 'default-2',
      content: "Let's discuss the timeline for our next project milestone. What are the key deliverables?",
      sender: 'project-manager',
      timestamp: '8/30/2025, 9:20:45 AM',
      type: 'user',
      status: 'read',
    },
    {
      id: 'msg-2-2',
      chatId: 'default-2',
      content: 'The main deliverables are the user interface mockups, database schema, and API documentation.',
      sender: 'team-lead',
      timestamp: '8/30/2025, 9:35:22 AM',
      type: 'assistant',
      status: 'read',
    },
    {
      id: 'msg-2-3',
      chatId: 'default-2',
      content: "Let's schedule the next milestone review for Friday.",
      sender: 'project-manager',
      timestamp: '9/1/2025, 11:30:22 AM',
      type: 'user',
      status: 'read',
    },
  ],
} as const;

class MessagesService {
  private messages: Message[] = [];
  private nextId = 3000; // Start custom IDs from 3000 to avoid conflicts

  constructor() {
    // Initialize with default messages
    this.createDefaults();
  }

  /**
   * Get all messages for a specific chat
   */
  async getByChatId(chatId: string): Promise<Message[]> {
    await this.delay(100);
    const chatMessages = this.messages.filter(m => m.chatId === chatId);
    return chatMessages.map(m => ({ ...m })); // Return copies
  }

  /**
   * Get message by ID
   */
  async getById(id: string): Promise<Message | null> {
    await this.delay(50);
    const message = this.messages.find(m => m.id === id);
    return message ? { ...message } : null; // Return a copy
  }

  /**
   * Get all messages
   */
  async getAll(): Promise<Message[]> {
    await this.delay(100);
    return [...this.messages]; // Return a copy
  }

  /**
   * Create a new message
   */
  async create(request: CreateMessageRequest): Promise<Message> {
    await this.delay(200);
    
    const newMessage: Message = {
      id: `message-${this.nextId++}`,
      chatId: request.chatId,
      content: request.content,
      sender: request.sender,
      type: request.type || 'user',
      status: request.status || 'sent',
      attachments: request.attachments,
      timestamp: new Date().toLocaleString(),
    };

    this.messages.push(newMessage);
    return { ...newMessage }; // Return a copy
  }

  /**
   * Update an existing message
   */
  async update(id: string, request: UpdateMessageRequest): Promise<Message | null> {
    await this.delay(200);
    
    const index = this.messages.findIndex(m => m.id === id);
    if (index === -1) return null;

    const updatedMessage: Message = {
      ...this.messages[index],
      ...request,
    };

    this.messages[index] = updatedMessage;
    return { ...updatedMessage }; // Return a copy
  }

  /**
   * Delete a message by ID
   */
  async delete(id: string): Promise<boolean> {
    await this.delay(150);
    
    const index = this.messages.findIndex(m => m.id === id);
    if (index === -1) return false;

    this.messages.splice(index, 1);
    return true;
  }

  /**
   * Delete all messages for a chat
   */
  async deleteByChatId(chatId: string): Promise<void> {
    await this.delay(100);
    this.messages = this.messages.filter(m => m.chatId !== chatId);
  }

  /**
   * Delete all messages
   */
  async deleteAll(): Promise<void> {
    await this.delay(100);
    this.messages = [];
  }

  /**
   * Create default messages (clone from immutable defaults)
   */
  async createDefaults(): Promise<Message[]> {
    await this.delay(300);
    
    const clonedDefaults: Message[] = [];
    
    Object.entries(DEFAULT_MESSAGES).forEach(([chatId, chatMessages]) => {
      chatMessages.forEach((defaultMessage, index) => {
        clonedDefaults.push({
          ...defaultMessage,
          id: `cloned-msg-${Date.now()}-${chatId}-${index}`, // Generate unique IDs
          timestamp: new Date().toLocaleString(), // Update timestamp
        });
      });
    });

    this.messages = [...clonedDefaults];
    return [...this.messages]; // Return a copy
  }

  /**
   * Get count of messages for a chat
   */
  async getCountByChatId(chatId: string): Promise<number> {
    await this.delay(50);
    return this.messages.filter(m => m.chatId === chatId).length;
  }

  /**
   * Search messages by content
   */
  async search(query: string, chatId?: string): Promise<Message[]> {
    await this.delay(100);
    
    if (!query.trim()) {
      return chatId 
        ? this.messages.filter(m => m.chatId === chatId).map(m => ({ ...m }))
        : [...this.messages];
    }
    
    const lowercaseQuery = query.toLowerCase();
    let filtered = this.messages.filter(message => 
      message.content.toLowerCase().includes(lowercaseQuery) ||
      message.sender.toLowerCase().includes(lowercaseQuery)
    );
    
    if (chatId) {
      filtered = filtered.filter(m => m.chatId === chatId);
    }
    
    return filtered.map(message => ({ ...message })); // Return copies
  }

  /**
   * Simulate API delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const messagesService = new MessagesService();
export default messagesService;
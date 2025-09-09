import { Message, CreateMessageRequest, UpdateMessageRequest } from '@/types/message';

// Immutable default messages for different chats
const DEFAULT_MESSAGES: Record<string, Readonly<Message[]>> = {
  'default-0': [
    {
      id: 'msg-0-1',
      chatId: 'default-0',
      content: "What's the weather in Oakland?",
      sender: 'user123',
      timestamp: '9/2/2025, 2:30:15 PM',
      type: 'user',
      status: 'read',
    },
    {
      id: 'msg-0-2',
      chatId: 'default-0',
      content: "I'll check the current weather in Oakland for you.",
      sender: 'weather-assistant',
      timestamp: '9/2/2025, 2:30:30 PM',
      type: 'tool_call',
      status: 'read',
      toolCalls: [
        {
          id: 'call_1234567890',
          type: 'function',
          function: {
            name: 'get_weather',
            arguments: '{"location": "Oakland, CA", "unit": "fahrenheit"}'
          }
        }
      ],
      approved: true,
    },
    {
      id: 'msg-0-3',
      chatId: 'default-0',
      content: '{"location": "Oakland, CA", "temperature": 72, "condition": "partly cloudy", "humidity": 65, "wind": "5 mph NW", "feels_like": 74}',
      sender: 'get_weather',
      timestamp: '9/2/2025, 2:30:35 PM',
      type: 'tool_response',
      status: 'read',
      toolCallId: 'call_1234567890',
    },
    {
      id: 'msg-0-4',
      chatId: 'default-0',
      content: 'The current weather in Oakland is 72°F and partly cloudy with light winds from the northwest at 5 mph. The humidity is at 65% and it feels like 74°F outside. Perfect weather for a walk!',
      sender: 'weather-assistant',
      timestamp: '9/2/2025, 2:35:45 PM',
      type: 'assistant',
      status: 'read',
    },
  ],
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
  'default-3': [
    {
      id: 'msg-3-1',
      chatId: 'default-3',
      content: 'Could you review the API documentation I sent over yesterday?',
      sender: 'user123',
      timestamp: '8/29/2025, 2:10:12 PM',
      type: 'user',
      status: 'read',
    },
    {
      id: 'msg-3-2',
      chatId: 'default-3',
      content: 'I\'ve reviewed the documentation. The endpoints are well-documented, but we need to add more examples.',
      sender: 'tech-writer',
      timestamp: '8/30/2025, 10:25:18 AM',
      type: 'assistant',
      status: 'read',
    },
    {
      id: 'msg-3-3',
      chatId: 'default-3',
      content: 'I\'ve added the examples and updated the authentication section.',
      sender: 'user123',
      timestamp: '8/31/2025, 3:15:22 PM',
      type: 'user',
      status: 'read',
    },
    {
      id: 'msg-3-4',
      chatId: 'default-3',
      content: 'The API documentation looks good to go.',
      sender: 'tech-writer',
      timestamp: '8/31/2025, 4:20:33 PM',
      type: 'assistant',
      status: 'read',
    },
  ],
  'default-4': [
    {
      id: 'msg-4-1',
      chatId: 'default-4',
      content: 'I found a bug in the user registration form. Users can\'t submit with special characters in their names.',
      sender: 'user123',
      timestamp: '8/28/2025, 11:05:18 AM',
      type: 'user',
      status: 'read',
    },
    {
      id: 'msg-4-2',
      chatId: 'default-4',
      content: 'Thank you for the report. I\'ll investigate this issue right away.',
      sender: 'qa-engineer',
      timestamp: '8/28/2025, 11:20:30 AM',
      type: 'assistant',
      status: 'read',
    },
    {
      id: 'msg-4-3',
      chatId: 'default-4',
      content: 'I\'ve reproduced the issue. It\'s related to input validation.',
      sender: 'qa-engineer',
      timestamp: '8/29/2025, 2:10:15 PM',
      type: 'assistant',
      status: 'read',
    },
    {
      id: 'msg-4-4',
      chatId: 'default-4',
      content: 'Issue has been reproduced and assigned to dev team.',
      sender: 'qa-engineer',
      timestamp: '8/30/2025, 9:15:45 AM',
      type: 'assistant',
      status: 'read',
    },
  ],
  'default-5': [
    {
      id: 'msg-5-1',
      chatId: 'default-5',
      content: 'I\'d like to request a dark mode feature for the application.',
      sender: 'user123',
      timestamp: '8/27/2025, 3:45:22 PM',
      type: 'user',
      status: 'read',
    },
    {
      id: 'msg-5-2',
      chatId: 'default-5',
      content: 'That\'s a great suggestion! Dark mode is definitely something our users have been asking for.',
      sender: 'product-manager',
      timestamp: '8/27/2025, 4:12:10 PM',
      type: 'assistant',
      status: 'read',
    },
    {
      id: 'msg-5-3',
      chatId: 'default-5',
      content: 'I can provide some mockups of how the dark theme would look across different pages.',
      sender: 'user123',
      timestamp: '8/28/2025, 10:30:45 AM',
      type: 'user',
      status: 'read',
    },
    {
      id: 'msg-5-4',
      chatId: 'default-5',
      content: 'That would be fantastic! Please share the mockups when you have them ready.',
      sender: 'product-manager',
      timestamp: '8/28/2025, 11:15:20 AM',
      type: 'assistant',
      status: 'read',
    },
    {
      id: 'msg-5-5',
      chatId: 'default-5',
      content: 'We\'ll add this to the next sprint backlog.',
      sender: 'product-manager',
      timestamp: '8/29/2025, 1:12:08 PM',
      type: 'assistant',
      status: 'read',
    },
  ],
  'default-6': [
    {
      id: 'msg-6-1',
      chatId: 'default-6',
      content: 'Welcome to our advanced React training session! Today we\'ll cover hooks and state management.',
      sender: 'trainer',
      timestamp: '8/26/2025, 10:30:15 AM',
      type: 'assistant',
      status: 'read',
    },
    {
      id: 'msg-6-2',
      chatId: 'default-6',
      content: 'Excited to learn about useEffect and useContext hooks!',
      sender: 'trainee1',
      timestamp: '8/26/2025, 10:32:20 AM',
      type: 'user',
      status: 'read',
    },
    {
      id: 'msg-6-3',
      chatId: 'default-6',
      content: 'Can you explain the difference between useState and useReducer?',
      sender: 'trainee2',
      timestamp: '8/26/2025, 11:15:30 AM',
      type: 'user',
      status: 'read',
    },
    {
      id: 'msg-6-4',
      chatId: 'default-6',
      content: 'Great question! useState is perfect for simple state, while useReducer is better for complex state logic with multiple actions.',
      sender: 'trainer',
      timestamp: '8/26/2025, 11:18:45 AM',
      type: 'assistant',
      status: 'read',
    },
    {
      id: 'msg-6-5',
      chatId: 'default-6',
      content: 'The examples you provided really helped clarify the concepts.',
      sender: 'user123',
      timestamp: '8/27/2025, 2:20:15 PM',
      type: 'user',
      status: 'read',
    },
    {
      id: 'msg-6-6',
      chatId: 'default-6',
      content: 'Thanks for the comprehensive training materials.',
      sender: 'trainee1',
      timestamp: '8/27/2025, 5:45:30 PM',
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
    
    // Import chatsService to get the actual chat IDs
    const { chatsService } = await import('@/services/chatsService');
    const chats = await chatsService.getAll();
    
    const clonedDefaults: Message[] = [];
    
    // Map default messages to actual chat IDs
    const defaultKeys = Object.keys(DEFAULT_MESSAGES);
    chats.forEach((chat, index) => {
      if (index < defaultKeys.length) {
        const defaultKey = defaultKeys[index];
        const defaultMessages = DEFAULT_MESSAGES[defaultKey];
        
        defaultMessages.forEach((defaultMessage, msgIndex) => {
          clonedDefaults.push({
            ...defaultMessage,
            id: `cloned-msg-${Date.now()}-${chat.id}-${msgIndex}`,
            chatId: chat.id, // Use the actual chat ID
            timestamp: new Date(Date.now() - (defaultMessages.length - msgIndex) * 3600000).toLocaleString(), // Spread messages over time
          });
        });
      }
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
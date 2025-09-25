import { Message, CreateMessageRequest, UpdateMessageRequest } from '@/types/message';

class MessagesService {
  private messages: Message[] = [];
  private nextId = 3000; // Start custom IDs from 3000 to avoid conflicts

  constructor() {
    // Start with an empty message store
    this.messages = [];
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
      toolCalls: request.toolCalls,
      toolCallId: request.toolCallId,
      approved: request.approved,
      isToolCall: request.isToolCall,
      rawMessage: request.rawMessage,
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

  // Removed seeding of mock default messages

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
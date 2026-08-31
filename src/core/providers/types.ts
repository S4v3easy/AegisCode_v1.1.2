export interface ChatMessage {
    role: 'system' | 'user';
    content: string;
}

export interface ChatOptions {
    model: string;
    temperature: number;
    timeoutMs: number;
}

export interface AIProvider {
    complete(messages: ChatMessage[], options: ChatOptions): Promise<string>;
}

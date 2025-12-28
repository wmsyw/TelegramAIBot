export type Compat = 'openai' | 'gemini' | 'claude';

export type AuthMethod =
  | 'bearer_token'
  | 'api_key_header'
  | 'query_param'
  | 'basic_auth'
  | 'custom_header';

export interface AuthConfig {
  method: AuthMethod;
  apiKey: string;
  headerName?: string;
  paramName?: string;
  username?: string;
  password?: string;
}

export interface Provider {
  apiKey: string;
  baseUrl: string;
  compatauth?: Compat;
  authMethod?: AuthMethod;
  authConfig?: AuthConfig;
}

export interface Models {
  chat: string;
  search: string;
  image: string;
  tts: string;
}

export interface VoiceConfig {
  gemini: string;
  openai: string;
}

export interface Telegraph {
  enabled: boolean;
  limit: number;
  token: string;
  posts: Array<{ title: string; url: string; createdAt: string }>;
}

export interface PromptTemplate {
  name: string;
  description?: string;
  content: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PromptStore {
  version: number;
  templates: Record<string, PromptTemplate>;
  activeByKind?: Partial<Record<keyof Models, string>>;
}

export interface Whitelist {
  admins: number[];
  allowed: number[];
  denied: number[];
  mode: 'allow' | 'deny';
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  thought?: string;
}

export interface AIResponse {
  content: string;
  thought?: string;
}

export interface ImageResponse {
  image?: Buffer;
  text?: string;
  mime?: string;
}

export interface TTSResponse {
  audio?: Buffer;
  mime?: string;
}

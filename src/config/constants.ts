export const MAX_MSG = 4096;
export const PAGE_EXTRA = 48;
export const WRAP_EXTRA_COLLAPSED = 64;

export const HISTORY_GLOBAL_MAX_SESSIONS = 200;
export const HISTORY_GLOBAL_MAX_BYTES = 10 * 1024 * 1024;
export const HISTORY_MAX_ITEMS_PER_SESSION = 200;
export const HISTORY_MAX_BYTES_PER_SESSION = 512 * 1024;

export const DEFAULT_RETRY_ATTEMPTS = 2;
export const DEFAULT_BACKOFF_MS = 500;
export const DEFAULT_TIMEOUT_MS = 120000;
export const MESSAGE_API_TIMEOUT_MS = 120000;
export const TTS_TIMEOUT_MS = 60000;

export const GEMINI_VOICES = [
  'Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda', 'Orus', 'Aoede',
  'Callirhoe', 'Autonoe', 'Enceladus', 'Iapetus', 'Umbriel', 'Algieba',
  'Despina', 'Erinome', 'Algenib', 'Rasalgethi', 'Laomedeia', 'Achernar',
  'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima', 'Achird', 'Zubenelgenubi',
  'Vindemiatrix', 'Sadachbia', 'Sadaltager', 'Sulafar',
] as const;

export const OPENAI_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] as const;

export type GeminiVoice = (typeof GEMINI_VOICES)[number];
export type OpenAIVoice = (typeof OPENAI_VOICES)[number];

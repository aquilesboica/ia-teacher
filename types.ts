
export interface Message {
  role: 'user' | 'teacher';
  text: string;
}

export interface TeacherState {
  isConnecting: boolean;
  isConnected: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  lastTranscription: string;
}

export interface PdfContent {
  text: string;
  fileName: string;
}

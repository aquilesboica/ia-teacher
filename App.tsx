
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Avatar } from './components/Avatar';
import PdfUploader from './components/PdfUploader';
import { 
  DEFAULT_SYSTEM_INSTRUCTION, 
  VOICE_NAME, 
  INPUT_SAMPLE_RATE, 
  OUTPUT_SAMPLE_RATE 
} from './constants';
import { PdfContent, TeacherState } from './types';
import { encode, decode, decodeAudioData } from './utils/audio';

const App: React.FC = () => {
  const [pdfContent, setPdfContent] = useState<PdfContent | null>(null);
  const [state, setState] = useState<TeacherState>({
    isConnecting: false,
    isConnected: false,
    isListening: false,
    isSpeaking: false,
    lastTranscription: '',
  });
  const [transcriptionHistory, setTranscriptionHistory] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const sessionRef = useRef<any>(null);
  const audioContextInRef = useRef<AudioContext | null>(null);
  const audioContextOutRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const currentInputTranscription = useRef('');
  const currentOutputTranscription = useRef('');

  const stopSession = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    if (audioContextInRef.current) {
      audioContextInRef.current.close();
      audioContextInRef.current = null;
    }
    if (audioContextOutRef.current) {
      audioContextOutRef.current.close();
      audioContextOutRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    setState(prev => ({ ...prev, isConnected: false, isListening: false, isSpeaking: false }));
  }, []);

  const startSession = async () => {
    if (state.isConnected) {
      stopSession();
      return;
    }

    setState(prev => ({ ...prev, isConnecting: true }));

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      
      const inCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: INPUT_SAMPLE_RATE });
      const outCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: OUTPUT_SAMPLE_RATE });
      audioContextInRef.current = inCtx;
      audioContextOutRef.current = outCtx;

      // ATIVAÇÃO DE CÂMERA E MICROFONE
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: { width: 640, height: 480 } 
      });
      mediaStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      const sysInstruction = pdfContent 
        ? `${DEFAULT_SYSTEM_INSTRUCTION}\n\nUSE THIS PDF AS YOUR BIBLE:\n${pdfContent.text}`
        : DEFAULT_SYSTEM_INSTRUCTION;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setState(prev => ({ ...prev, isConnected: true, isConnecting: false, isListening: true }));

            const source = inCtx.createMediaStreamSource(stream);
            const scriptProcessor = inCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = scriptProcessor;

            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) {
                int16[i] = inputData[i] * 32768;
              }
              const pcmBlob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };

              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(inCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.outputTranscription) {
              currentOutputTranscription.current += message.serverContent.outputTranscription.text;
            } else if (message.serverContent?.inputTranscription) {
              currentInputTranscription.current += message.serverContent.inputTranscription.text;
            }

            if (message.serverContent?.turnComplete) {
              setTranscriptionHistory(prev => [
                ...prev, 
                `You: ${currentInputTranscription.current}`, 
                `Sterling: ${currentOutputTranscription.current}`
              ].slice(-10));
              currentInputTranscription.current = '';
              currentOutputTranscription.current = '';
            }

            const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData) {
              // ATIVA O VISUAL DO AVATAR EM SINCRONIA COM O ÁUDIO
              setState(prev => ({ ...prev, isSpeaking: true }));
              
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outCtx.currentTime);
              const buffer = await decodeAudioData(decode(audioData), outCtx, OUTPUT_SAMPLE_RATE, 1);
              const source = outCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(outCtx.destination);
              
              source.onended = () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) {
                  // DESATIVA O VISUAL QUANDO O ÁUDIO ACABA
                  setState(prev => ({ ...prev, isSpeaking: false }));
                }
              };

              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setState(prev => ({ ...prev, isSpeaking: false }));
            }
          },
          onerror: (e) => {
            console.error('Session Error:', e);
            stopSession();
          },
          onclose: () => {
            stopSession();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE_NAME } },
          },
          systemInstruction: sysInstruction,
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        }
      });

      sessionRef.current = await sessionPromise;

    } catch (err) {
      console.error('Connection Failed:', err);
      setState(prev => ({ ...prev, isConnecting: false }));
      alert('We need your camera and microphone to start the lesson!');
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#050705] text-white overflow-hidden selection:bg-emerald-500/30">
      {/* Sidebar Control Panel */}
      <div className="w-full md:w-80 lg:w-96 p-8 flex flex-col space-y-10 bg-[#0a0c0a] border-r border-white/5 shadow-2xl z-30">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-900/40">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter">Sterling AI</h1>
            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Master Class</p>
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] px-1">Curriculum</h3>
          {pdfContent ? (
            <div className="p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl flex items-center justify-between group">
              <div className="flex items-center space-x-3 truncate">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 012-2h4.586A1 1 0 0111.293 2.707l5 5a1 1 0 01.293.707V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" /></svg>
                </div>
                <div className="truncate">
                  <p className="text-xs font-bold truncate">{pdfContent.fileName}</p>
                  <p className="text-[9px] font-black text-emerald-500 uppercase">Synchronized</p>
                </div>
              </div>
              <button onClick={() => setPdfContent(null)} className="p-2 hover:text-red-400 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          ) : (
            <PdfUploader onContentParsed={setPdfContent} isProcessing={state.isConnecting} />
          )}
        </div>

        <div className="flex flex-col space-y-4">
          <button
            onClick={startSession}
            disabled={state.isConnecting}
            className={`w-full py-6 rounded-[2.5rem] text-lg font-black transition-all transform active:scale-95 shadow-2xl flex items-center justify-center space-x-3 ${
              state.isConnected ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-white text-black hover:bg-emerald-50'
            }`}
          >
            {state.isConnecting ? <div className="w-6 h-6 border-3 border-black/20 border-t-black rounded-full animate-spin" /> : (
              <span>{state.isConnected ? 'End Session' : 'Start Lesson'}</span>
            )}
          </button>
          
          <p className="text-[10px] text-center text-white/20 font-bold tracking-tight px-4 leading-relaxed">
            By clicking start, you enable your camera and microphone for real-time interaction.
          </p>
        </div>
      </div>

      {/* Main Classroom View */}
      <div className="flex-1 relative flex flex-col bg-[#050705]">
        <div className="flex-1 flex items-center justify-center p-8 md:p-16">
          <Avatar 
            isConnected={state.isConnected} 
            isSpeaking={state.isSpeaking} 
            isListening={state.isListening} 
          />
        </div>

        {/* Floating Student Camera Feed */}
        <div className={`absolute top-10 right-10 w-48 h-48 md:w-64 md:h-64 bg-black rounded-[3rem] overflow-hidden border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] z-40 transition-all duration-1000 ${state.isConnected ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'}`}>
           <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="w-full h-full object-cover scale-x-[-1] brightness-110 contrast-110" 
           />
           <div className="absolute bottom-4 left-4 flex items-center space-x-2 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-widest">You</span>
           </div>
        </div>

        {/* Live Subtitles / Transcript */}
        <div className="absolute bottom-10 left-10 right-10 md:left-auto md:right-10 md:w-[450px] h-32 bg-black/40 backdrop-blur-3xl rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden flex flex-col z-20">
          <div className="px-6 py-2 border-b border-white/5 text-[9px] font-black text-white/20 uppercase tracking-[0.3em]">Live Subtitles</div>
          <div className="flex-1 overflow-y-auto p-5 scrollbar-hide">
            {transcriptionHistory.length === 0 ? (
              <p className="text-xs text-white/10 font-bold uppercase tracking-tight text-center py-4 italic">Waiting for conversation...</p>
            ) : (
              transcriptionHistory.map((text, i) => (
                <p key={i} className={`text-xs mb-2 ${text.startsWith('You') ? 'text-emerald-400' : 'text-white/80'} font-bold leading-relaxed`}>
                  {text}
                </p>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;

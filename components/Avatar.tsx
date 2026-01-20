
import React, { useEffect, useState } from 'react';

interface AvatarProps {
  isSpeaking: boolean;
  isListening: boolean;
  isConnected: boolean;
}

export const Avatar: React.FC<AvatarProps> = ({ isSpeaking, isListening, isConnected }) => {
  const [blink, setBlink] = useState(false);
  const [mouthState, setMouthState] = useState({ open: 0, stretch: 1 });

  // Sistema de Piscada Natural
  useEffect(() => {
    const triggerBlink = () => {
      setBlink(true);
      setTimeout(() => setBlink(false), 120);
      const nextBlink = 2500 + Math.random() * 4000;
      return setTimeout(triggerBlink, nextBlink);
    };
    const timer = triggerBlink();
    return () => clearTimeout(timer);
  }, []);

  // Animação de Fala (Lip-Sync Visual)
  useEffect(() => {
    let interval: any;
    if (isSpeaking) {
      interval = setInterval(() => {
        // Simula diferentes formas de boca (vogais/consoantes)
        setMouthState({
          open: 0.4 + Math.random() * 1.4,
          stretch: 0.9 + Math.random() * 0.3
        });
      }, 65); // Velocidade de fala natural
    } else {
      setMouthState({ open: 0, stretch: 1 });
    }
    return () => clearInterval(interval);
  }, [isSpeaking]);

  // Imagem Profissional de Professora
  const avatarImage = "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=1200&auto=format&fit=crop";

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-[3rem] shadow-2xl bg-[#080a08]">
      {/* Glow de Fala (O anel que brilha quando ela fala) */}
      <div className={`absolute w-[110%] h-[110%] rounded-full transition-all duration-300 blur-[80px] ${
        isSpeaking ? 'bg-orange-500/20 scale-100 opacity-100' : 'bg-transparent scale-90 opacity-0'
      }`} />

      {/* Aura de Escuta (Verde quando o aluno fala) */}
      <div className={`absolute w-[120%] h-[120%] rounded-full transition-all duration-1000 blur-[100px] ${
        isListening ? 'bg-emerald-500/15 scale-110' : 'bg-transparent'
      }`} />

      {/* Container Principal */}
      <div 
        className={`relative h-full w-full flex items-center justify-center transition-all duration-700 ease-in-out transform ${
          isListening ? 'scale-105' : 'scale-100'
        }`}
        style={{ animation: isConnected ? 'breathing 6s ease-in-out infinite' : 'none' }}
      >
        <div className="relative h-full aspect-[4/5] max-h-[90%] shadow-[0_0_120px_rgba(0,0,0,0.7)] overflow-hidden rounded-[3.5rem] border border-white/10">
          {/* A Foto */}
          <img 
            src={avatarImage} 
            alt="AI Teacher" 
            className={`h-full w-full object-cover transition-all duration-1000 ${
              isConnected ? 'brightness-110 contrast-110' : 'brightness-30 grayscale'
            }`}
          />

          {/* MÁSCARA DOS OLHOS (Piscada) */}
          <div className="absolute top-[34.2%] left-[32%] w-[36%] h-[4%] pointer-events-none flex justify-between px-3">
            <div className={`w-[32%] h-full bg-[#3d2b1f] blur-[1.5px] transition-opacity duration-150 ${blink ? 'opacity-90' : 'opacity-0'}`} style={{ borderRadius: '50%' }} />
            <div className={`w-[32%] h-full bg-[#3d2b1f] blur-[1.5px] transition-opacity duration-150 ${blink ? 'opacity-90' : 'opacity-0'}`} style={{ borderRadius: '50%' }} />
          </div>

          {/* BOCA DINÂMICA (A imagem falando visualmente) */}
          <div 
            className="absolute top-[57.5%] left-[41.5%] w-[17%] h-[7%] pointer-events-none flex items-center justify-center"
            style={{ 
              opacity: isSpeaking ? 0.95 : 0,
              transform: `scaleY(${mouthState.open}) scaleX(${mouthState.stretch})`,
              transition: 'transform 0.06s ease-out'
            }}
          >
            {/* Cavidade Oral */}
            <div className="w-full h-full bg-[#1a0502] rounded-full shadow-[inset_0_0_15px_black] blur-[0.5px]" />
            {/* Dentes Superiores */}
            <div className="absolute top-0 w-[75%] h-[20%] bg-white/40 blur-[1px] rounded-full" />
            {/* Sombra de Integração */}
            <div className="absolute -inset-2 bg-red-900/10 blur-[5px] rounded-full -z-10" />
          </div>

          {/* Sombra de profundidade para a fala */}
          <div 
            className="absolute top-[56%] left-[38%] w-[24%] h-[10%] bg-black/25 blur-[12px] pointer-events-none rounded-full"
            style={{ opacity: isSpeaking ? 0.4 : 0 }}
          />
        </div>

        {/* Indicador Visual de Transmissão de Voz */}
        {isSpeaking && (
          <div className="absolute bottom-[15%] flex space-x-1.5 h-12 items-end">
            {[...Array(8)].map((_, i) => (
              <div 
                key={i} 
                className="w-1.5 bg-gradient-to-t from-orange-600 to-yellow-400 rounded-full shadow-[0_0_15px_rgba(234,88,12,0.5)]"
                style={{
                  height: `${20 + Math.random() * 80}%`,
                  animation: `pulse-voice 0.4s ease-in-out infinite alternate`,
                  animationDelay: `${i * 0.05}s`
                }}
              />
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes breathing {
          0%, 100% { transform: scale(1) translateY(0); }
          50% { transform: scale(1.002) translateY(-4px); }
        }
        @keyframes pulse-voice {
          from { transform: scaleY(0.3); opacity: 0.5; }
          to { transform: scaleY(1.4); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

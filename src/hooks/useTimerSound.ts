// Hook para gerar sons de timer via Web Audio API

import { useCallback, useRef, useEffect } from 'react';

export function useTimerSound() {
    const audioContextRef = useRef<AudioContext | null>(null);

    // Inicializa AudioContext sob demanda (precisa de interação do usuário)
    const getAudioContext = useCallback(() => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        return audioContextRef.current;
    }, []);

    // Gera um beep com frequência, duração e volume especificados
    const playBeep = useCallback((frequency: number, duration: number, volume: number = 0.3) => {
        try {
            const ctx = getAudioContext();

            // Cria oscilador e gain
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

            // Envelope para evitar cliques
            gainNode.gain.setValueAtTime(0, ctx.currentTime);
            gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
            gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + duration - 0.05);
            gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + duration);
        } catch (e) {
            console.warn('Erro ao reproduzir som:', e);
        }
    }, [getAudioContext]);

    // Som de aviso (15 segundos) - tom médio suave
    const playWarningSound = useCallback(() => {
        playBeep(440, 0.15, 0.2);  // Lá4, curto e suave
    }, [playBeep]);

    // Som crítico (5 segundos) - tom mais agudo
    const playCriticalSound = useCallback(() => {
        playBeep(660, 0.2, 0.3);  // Mi5, um pouco mais longo
    }, [playBeep]);

    // Som de expiração - tom mais grave e longo
    const playExpiredSound = useCallback(() => {
        playBeep(220, 0.4, 0.35);  // Lá3, mais longo e grave
    }, [playBeep]);

    // Cleanup
    useEffect(() => {
        return () => {
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
        };
    }, []);

    return {
        playWarningSound,
        playCriticalSound,
        playExpiredSound,
    };
}

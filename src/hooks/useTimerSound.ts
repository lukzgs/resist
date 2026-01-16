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

    // Gera um som suave com envelope melhorado
    const playSoftTone = useCallback((frequency: number, duration: number, volume: number = 0.15) => {
        try {
            const ctx = getAudioContext();

            // Cria oscilador e gain
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            // Usa onda senoidal para som mais suave
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

            // Envelope suave com attack e decay mais naturais
            gainNode.gain.setValueAtTime(0, ctx.currentTime);
            gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.05);
            gainNode.gain.exponentialRampToValueAtTime(volume * 0.7, ctx.currentTime + duration * 0.3);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + duration);
        } catch (e) {
            console.warn('Erro ao reproduzir som:', e);
        }
    }, [getAudioContext]);

    // Som de notificação suave (dois tons)
    const playNotificationSound = useCallback((baseFreq: number, volume: number, count: number = 1) => {
        try {
            const ctx = getAudioContext();

            for (let i = 0; i < count; i++) {
                setTimeout(() => {
                    const oscillator = ctx.createOscillator();
                    const gainNode = ctx.createGain();

                    oscillator.connect(gainNode);
                    gainNode.connect(ctx.destination);

                    oscillator.type = 'sine';
                    oscillator.frequency.setValueAtTime(baseFreq, ctx.currentTime);
                    oscillator.frequency.linearRampToValueAtTime(baseFreq * 1.2, ctx.currentTime + 0.1);

                    gainNode.gain.setValueAtTime(0, ctx.currentTime);
                    gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.02);
                    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

                    oscillator.start(ctx.currentTime);
                    oscillator.stop(ctx.currentTime + 0.25);
                }, i * 200);
            }
        } catch (e) {
            console.warn('Erro ao reproduzir som:', e);
        }
    }, [getAudioContext]);

    // Som de aviso (15 segundos) - "ding" suave
    const playWarningSound = useCallback(() => {
        playNotificationSound(880, 0.12, 1);  // Lá5, suave
    }, [playNotificationSound]);

    // Som crítico (5 segundos) - dois "dings" mais urgentes
    const playCriticalSound = useCallback(() => {
        playNotificationSound(1047, 0.15, 2);  // Dó6, dois toques
    }, [playNotificationSound]);

    // Som de expiração - tom descendente suave
    const playExpiredSound = useCallback(() => {
        try {
            const ctx = getAudioContext();

            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(660, ctx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(330, ctx.currentTime + 0.4);

            gainNode.gain.setValueAtTime(0, ctx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.02);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.5);
        } catch (e) {
            console.warn('Erro ao reproduzir som:', e);
        }
    }, [getAudioContext]);

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


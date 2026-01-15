// Componente de timer circular com contagem regressiva

import React, { useEffect, useState, useRef } from 'react';
import { useTimerSound } from '../hooks/useTimerSound';
import { useTranslation } from '../i18n';

interface Props {
    endsAt: number;           // Timestamp de quando expira
    onExpire?: () => void;    // Callback quando expirar
    label?: string;           // Label opcional (ex: "Escolha o time")
}

export function TimerCircle({ endsAt, onExpire, label }: Props) {
    const { t } = useTranslation();
    const { playWarningSound, playCriticalSound, playExpiredSound } = useTimerSound();

    const [timeLeft, setTimeLeft] = useState<number>(0);
    const [totalTime, setTotalTime] = useState<number>(0);

    // Refs para controlar sons já tocados
    const warningSoundPlayed = useRef(false);
    const criticalSoundPlayed = useRef(false);
    const expiredSoundPlayed = useRef(false);

    // Calcula tempo total quando endsAt muda
    useEffect(() => {
        const now = Date.now();
        const total = Math.max(0, Math.ceil((endsAt - now) / 1000));
        setTotalTime(total);
        setTimeLeft(total);

        // Reset sons
        warningSoundPlayed.current = false;
        criticalSoundPlayed.current = false;
        expiredSoundPlayed.current = false;
    }, [endsAt]);

    // Atualiza a cada segundo
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));
            setTimeLeft(remaining);

            // Toca sons de alerta
            if (remaining <= 15 && remaining > 5 && !warningSoundPlayed.current) {
                playWarningSound();
                warningSoundPlayed.current = true;
            }

            if (remaining <= 5 && remaining > 0 && !criticalSoundPlayed.current) {
                playCriticalSound();
                criticalSoundPlayed.current = true;
            }

            if (remaining === 0 && !expiredSoundPlayed.current) {
                playExpiredSound();
                expiredSoundPlayed.current = true;
                if (onExpire) onExpire();
            }
        }, 100);

        return () => clearInterval(interval);
    }, [endsAt, onExpire, playWarningSound, playCriticalSound, playExpiredSound]);

    // Calcula progresso (0 a 1)
    const progress = totalTime > 0 ? timeLeft / totalTime : 0;

    // Calcula circunferência e offset para o SVG
    const radius = 45;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference * (1 - progress);

    // Cor baseada no tempo restante
    let strokeColor = 'stroke-cyan-500';
    let textColor = 'text-cyan-400';
    let glowColor = 'shadow-cyan-500/30';

    if (timeLeft <= 5) {
        strokeColor = 'stroke-red-500';
        textColor = 'text-red-400';
        glowColor = 'shadow-red-500/50';
    } else if (timeLeft <= 15) {
        strokeColor = 'stroke-yellow-500';
        textColor = 'text-yellow-400';
        glowColor = 'shadow-yellow-500/40';
    }

    // Formatação do tempo
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const timeDisplay = minutes > 0
        ? `${minutes}:${seconds.toString().padStart(2, '0')}`
        : `${seconds}`;

    return (
        <div className={`flex flex-col items-center gap-1 ${timeLeft <= 5 ? 'animate-pulse' : ''}`}>
            <div className={`relative w-24 h-24 drop-shadow-lg ${glowColor}`}>
                {/* SVG circular */}
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    {/* Fundo do círculo */}
                    <circle
                        cx="50"
                        cy="50"
                        r={radius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="6"
                        className="text-slate-700/50"
                    />
                    {/* Progresso */}
                    <circle
                        cx="50"
                        cy="50"
                        r={radius}
                        fill="none"
                        strokeWidth="6"
                        strokeLinecap="round"
                        className={`${strokeColor} transition-all duration-100`}
                        style={{
                            strokeDasharray: circumference,
                            strokeDashoffset: strokeDashoffset,
                        }}
                    />
                </svg>

                {/* Tempo no centro */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-2xl font-bold font-mono ${textColor}`}>
                        {timeDisplay}
                    </span>
                </div>
            </div>

            {/* Label opcional */}
            {label && (
                <span className="text-xs text-slate-400 text-center max-w-[100px] truncate">
                    {label}
                </span>
            )}
        </div>
    );
}

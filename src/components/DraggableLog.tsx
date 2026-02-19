
import React, { useState, useRef, useCallback, useEffect } from 'react';

interface DraggableLogProps {
    logs: string[];
}

const DraggableLog: React.FC<DraggableLogProps> = ({ logs }) => {
    // Estado para posição e tamanho do log arrastável - começa no canto inferior direito
    const [logPosition, setLogPosition] = useState({ x: typeof window !== 'undefined' ? window.innerWidth - 200 : 16, y: typeof window !== 'undefined' ? window.innerHeight - 180 : 100 });
    const [logDimensions, setLogDimensions] = useState({ width: 280, height: 160 });
    const [logSize, setLogSize] = useState<'minimized' | 'normal' | 'expanded'>('minimized'); // Start minimized on mobile
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });
    const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0 });
    const logRef = useRef<HTMLDivElement>(null);

    // Helper to get clientX/Y from mouse or touch event
    const getEventPosition = (e: MouseEvent | TouchEvent) => {
        if ('touches' in e) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        return { x: e.clientX, y: e.clientY };
    };

    const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        const rect = logRef.current?.getBoundingClientRect();
        if (rect) {
            const pos = 'touches' in e
                ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
                : { x: e.clientX, y: e.clientY };
            dragOffset.current = {
                x: pos.x - rect.left,
                y: pos.y - rect.top
            };
        }
        setIsDragging(true);
    }, []);

    const handleResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const pos = 'touches' in e
            ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
            : { x: e.clientX, y: e.clientY };
        resizeStart.current = {
            x: pos.x,
            y: pos.y,
            width: logDimensions.width,
            height: logDimensions.height
        };
        setIsResizing(true);
    }, [logDimensions]);

    // Drag movement effect
    useEffect(() => {
        if (!isDragging) return;

        const handleMove = (e: MouseEvent | TouchEvent) => {
            const pos = getEventPosition(e);
            const newX = Math.max(0, Math.min(pos.x - dragOffset.current.x, window.innerWidth - 150));
            const newY = Math.max(0, Math.min(pos.y - dragOffset.current.y, window.innerHeight - 100));
            setLogPosition({ x: newX, y: newY });
        };

        const handleEnd = () => {
            setIsDragging(false);
        };

        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleEnd);
        document.addEventListener('touchmove', handleMove, { passive: false });
        document.addEventListener('touchend', handleEnd);

        return () => {
            document.removeEventListener('mousemove', handleMove);
            document.removeEventListener('mouseup', handleEnd);
            document.removeEventListener('touchmove', handleMove);
            document.removeEventListener('touchend', handleEnd);
        };
    }, [isDragging]);

    // Resize movement effect
    useEffect(() => {
        if (!isResizing) return;

        const handleMove = (e: MouseEvent | TouchEvent) => {
            const pos = getEventPosition(e);
            const deltaX = pos.x - resizeStart.current.x;
            const deltaY = pos.y - resizeStart.current.y;
            const newWidth = Math.max(150, Math.min(resizeStart.current.width + deltaX, 500));
            const newHeight = Math.max(80, Math.min(resizeStart.current.height + deltaY, 350));
            setLogDimensions({ width: newWidth, height: newHeight });
            setLogSize('normal');
        };

        const handleEnd = () => {
            setIsResizing(false);
        };

        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleEnd);
        document.addEventListener('touchmove', handleMove, { passive: false });
        document.addEventListener('touchend', handleEnd);

        return () => {
            document.removeEventListener('mousemove', handleMove);
            document.removeEventListener('mouseup', handleEnd);
            document.removeEventListener('touchmove', handleMove);
            document.removeEventListener('touchend', handleEnd);
        };
    }, [isResizing]);

    return (
        <div
            ref={logRef}
            className={`draggable-log fixed bg-black/60 p-4 rounded-xl border border-white/5 backdrop-blur-md opacity-40 hover:opacity-100 transition-opacity z-40 ${isDragging || isResizing ? 'cursor-grabbing' : ''}`}
            style={{
                left: logPosition.x,
                top: logPosition.y,
                width: logSize === 'minimized' ? 180 : logDimensions.width,
                height: logSize === 'minimized' ? 'auto' : logDimensions.height,
                userSelect: (isDragging || isResizing) ? 'none' : 'auto',
                transition: (isDragging || isResizing) ? 'none' : 'opacity 0.2s'
            }}
        >
            <div
                className="flex justify-between items-center mb-3 border-b border-white/10 pb-1 cursor-grab active:cursor-grabbing"
                onMouseDown={handleDragStart}
                onTouchStart={handleDragStart}
            >
                <span className="text-xs font-mono text-resistance font-bold truncate">
                    {logSize === 'minimized' ? 'LOG' : 'SYSTEM_LOG_v3.1'}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                    {logSize !== 'minimized' && <span className="text-[10px] text-slate-300 mr-2">⋮⋮</span>}
                    {/* Botões de controle de janela */}
                    <button
                        onClick={(e) => { e.stopPropagation(); setLogSize('minimized'); }}
                        className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-400 transition-colors"
                        title="Minimizar"
                    />
                    <button
                        onClick={(e) => { e.stopPropagation(); setLogSize(logSize === 'expanded' ? 'normal' : 'expanded'); setLogDimensions(logSize === 'expanded' ? { width: 288, height: 180 } : { width: 384, height: 280 }); }}
                        className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-400 transition-colors"
                        title="Expandir"
                    />
                </div>
            </div>
            {logSize !== 'minimized' && (
                <div className="overflow-y-auto pr-2 custom-scrollbar flex-1" style={{ height: logDimensions.height - 60 }}>
                    <div className="space-y-1.5">
                        {logs.slice(-Math.floor((logDimensions.height - 60) / 20)).map(function (log, i) {
                            return (
                                <div key={i} className="text-xs font-mono text-slate-300 border-l border-slate-800 pl-2 leading-tight lowercase">
                                    <span className="text-slate-300 mr-2">[{1024 + i}]</span>
                                    {log}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Resize Handle */}
            {logSize !== 'minimized' && (
                <div
                    className="absolute bottom-1 right-1 w-6 h-6 cursor-se-resize flex items-center justify-center text-slate-300 hover:text-slate-300 transition-colors touch-none"
                    onMouseDown={handleResizeStart}
                    onTouchStart={handleResizeStart}
                >
                    <svg width="12" height="12" viewBox="0 0 10 10" fill="currentColor">
                        <path d="M9 1L1 9M9 5L5 9M9 9L9 9" stroke="currentColor" strokeWidth="1.5" fill="none" />
                    </svg>
                </div>
            )}
        </div>
    );
};

export default DraggableLog;

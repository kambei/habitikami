
import { motion, AnimatePresence } from 'framer-motion';
import { useRef } from 'react';
import type { NoteData } from '../types';

interface MobiusRingProps {
    days: (NoteData & { offset: number })[];
    onWheel: (e: React.WheelEvent) => void;
    onSave: (date: string, content: string, links: string[]) => void;
    onSetFocus: (date: string) => void;
    onOpenLinkPicker: (date: string) => void;
    onShowLinks?: (links: string[]) => void;
    readOnly?: boolean;
}

export function MobiusRing({ days, onWheel, onSave, onSetFocus, onOpenLinkPicker, onShowLinks, readOnly = false }: MobiusRingProps) {
    const touchStartY = useRef<number | null>(null);
    const touchLastY = useRef<number | null>(null);
    const accumulatedDelta = useRef<number>(0);
    const SWIPE_THRESHOLD = 40; // px per step

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartY.current = e.touches[0].clientY;
        touchLastY.current = e.touches[0].clientY;
        accumulatedDelta.current = 0;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (touchLastY.current === null) return;
        const currentY = e.touches[0].clientY;
        const delta = touchLastY.current - currentY; // positive = swipe up = forward
        accumulatedDelta.current += delta;
        touchLastY.current = currentY;

        // Fire step when threshold crossed
        if (Math.abs(accumulatedDelta.current) >= SWIPE_THRESHOLD) {
            const syntheticEvent = { deltaY: accumulatedDelta.current } as React.WheelEvent;
            onWheel(syntheticEvent);
            accumulatedDelta.current = 0;
        }

        // Prevent page scroll/back gesture while swiping inside the ring
        e.preventDefault();
    };

    const handleTouchEnd = () => {
        touchStartY.current = null;
        touchLastY.current = null;
        accumulatedDelta.current = 0;
    };

    return (
        <div
            className="relative w-full max-w-md h-[400px] preserve-3d flex items-center justify-center shrink-0"
            onWheel={onWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ touchAction: 'none' }}
        >
            <AnimatePresence>
                {days.map((card) => {
                    const isActive = card.offset === 0;
                    // Constants for ring layout
                    const rotateX = card.offset * -20;
                    const y = card.offset * 80;
                    const opacity = 1 - Math.abs(card.offset) * 0.2;
                    const scale = 1 - Math.abs(card.offset) * 0.1;

                    return (
                        <motion.div
                            key={card.date}
                            className={`absolute w-64 h-64 bg-card border border-border rounded-xl p-4 shadow-xl flex flex-col gap-2 transition-all duration-500
                            ${isActive ? 'z-20 border-primary shadow-primary/20' : 'z-10 bg-card/50 grayscale blur-[1px]'}
                        `}
                            style={{
                                top: '50%',
                                left: '50%',
                                x: '-50%',
                                y: `calc(-50% + ${y}px)`,
                                zIndex: 10 - Math.abs(card.offset),
                                scale: scale,
                                opacity: Math.max(0, opacity),
                            }}
                            initial={false}
                            animate={{
                                y: `calc(-50% + ${y}px)`,
                                scale: scale,
                                opacity: Math.max(0, opacity),
                                zIndex: 10 - Math.abs(card.offset),
                                rotateX: rotateX
                            }}
                        >
                            <div className="flex justify-between items-center border-b border-white/10 pb-2">
                                <span className={`font-mono font-bold ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>{card.date}</span>
                                {isActive && <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">Current</span>}
                            </div>

                            <textarea
                                className="flex-1 bg-transparent resize-none border-none outline-none text-sm font-sans p-1"
                                placeholder={isActive && !readOnly ? "Write your note here..." : ""}
                                value={card.content}
                                readOnly={!isActive || readOnly}
                                onChange={(e) => isActive && !readOnly && onSave(card.date, e.target.value, card.links)}
                                onTouchStart={(e) => isActive && e.stopPropagation()}
                                onTouchMove={(e) => isActive && e.stopPropagation()}
                            />

                            {/* Links Section */}
                            <div className="border-t border-white/10 pt-2 flex flex-wrap gap-1 min-h-[40px] content-end items-center">
                                {card.links.map(link => (
                                    <span
                                        key={link}
                                        onClick={(e) => { e.stopPropagation(); onSetFocus(link); }}
                                        className="text-xs px-2 py-0.5 bg-secondary text-secondary-foreground rounded cursor-pointer hover:bg-secondary/80 border border-secondary"
                                    >
                                        @{link}
                                    </span>
                                ))}
                                {isActive && !readOnly && (
                                    <button
                                        className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded hover:bg-primary/20 border border-primary/20"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onOpenLinkPicker(card.date);
                                        }}
                                    >
                                        + Link
                                    </button>
                                )}
                                {isActive && card.links.length > 0 && onShowLinks && (
                                    <button
                                        className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded hover:bg-purple-500/30 border border-purple-500/30 ml-auto"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onShowLinks(card.links);
                                        }}
                                    >
                                        Show Linked Days ({card.links.length}) &rarr;
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
}

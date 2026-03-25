import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, X, RotateCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';

interface ExpandableGraphProps {
    children: React.ReactNode;
    title: string;
    containerClassName?: string;
}

export const ExpandableGraph: React.FC<ExpandableGraphProps> = ({ children, title, containerClassName }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isRotated, setIsRotated] = useState(false);

    // Disable scrolling on body when expanded
    useEffect(() => {
        if (isExpanded) {
            document.body.style.overflow = 'hidden';
            
            // Try to lock orientation to landscape if supported
            const screenAny = window.screen as any;
            if (screenAny?.orientation?.lock) {
                screenAny.orientation.lock('landscape').catch(() => {
                    // Ignore errors if orientation lock is not supported or requires fullscreen
                });
            }
        } else {
            document.body.style.overflow = '';
            const screenAny = window.screen as any;
            if (screenAny?.orientation?.unlock) {
                screenAny.orientation.unlock();
            }
            setIsRotated(false); // Reset rotation when closing
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isExpanded]);

    const toggleExpand = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsExpanded(!isExpanded);
    };

    const toggleRotate = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsRotated(!isRotated);
    };

    return (
        <div className={cn("relative group", containerClassName)}>
            {/* Expand Button - Visible only on mobile/small screens */}
            <button
                onClick={toggleExpand}
                className="absolute top-2 right-2 z-10 p-2 bg-background/80 hover:bg-background border border-border rounded-lg shadow-sm flex items-center justify-center transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
                title="Expand Graph"
            >
                <Maximize2 className="w-4 h-4 text-foreground" />
            </button>

            {/* Original Content */}
            {children}

            {/* Fullscreen Overlay */}
            {isExpanded && createPortal(
                <AnimatePresence mode="wait">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9999] bg-background flex flex-col p-4 md:p-6"
                    >
                        <div className="flex items-center justify-between mb-4 shrink-0">
                            <h3 className="text-lg font-bold truncate pr-4">{title}</h3>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={toggleRotate}
                                    className={cn(
                                        "p-2 rounded-full transition-colors flex items-center gap-2 text-sm font-medium",
                                        isRotated ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/80 text-foreground"
                                    )}
                                    title="Rotate View"
                                >
                                    <RotateCw className={cn("w-5 h-5", isRotated && "rotate-90")} />
                                    <span className="hidden sm:inline">Rotate</span>
                                </button>
                                <button
                                    onClick={toggleExpand}
                                    className="p-2 bg-secondary hover:bg-secondary/80 rounded-full transition-colors"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                        </div>
                        
                        <div className="flex-1 w-full h-full min-h-0 relative flex items-center justify-center overflow-hidden">
                            <div 
                                className={cn(
                                    "w-full h-full transition-all duration-300 flex items-center justify-center",
                                    isRotated && "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[10000] bg-background w-[100dvh] h-[100dvw] rotate-90 origin-center"
                                )}
                            >
                                <div className="w-full h-full relative p-4">
                                    {children}
                                    
                                    {/* Small floating close/rotate buttons if rotated fixed fullscreen */}
                                    {isRotated && (
                                        <div className="absolute top-4 right-4 z-[10001] flex flex-col gap-4 -rotate-90 origin-center">
                                            <button
                                                onClick={toggleExpand}
                                                className="p-3 bg-secondary/80 hover:bg-secondary rounded-full backdrop-blur-sm shadow-xl flex items-center justify-center"
                                            >
                                                <X className="w-6 h-6" />
                                            </button>
                                            <button
                                                onClick={toggleRotate}
                                                className="p-3 bg-primary/80 hover:bg-primary text-primary-foreground rounded-full backdrop-blur-sm shadow-xl flex items-center justify-center"
                                            >
                                                <RotateCw className="w-6 h-6" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Recommendation for portrait users */}
                        {!isRotated && (
                            <div className="mt-2 text-center sm:hidden shrink-0">
                                <p className="text-xs text-muted-foreground animate-pulse">
                                    Rotate your device or use the rotate button for the best view
                                </p>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
};

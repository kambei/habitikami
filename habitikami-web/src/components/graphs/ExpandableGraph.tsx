import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';

interface ExpandableGraphProps {
    children: React.ReactNode;
    title: string;
    containerClassName?: string;
}

export const ExpandableGraph: React.FC<ExpandableGraphProps> = ({ children, title, containerClassName }) => {
    const [isExpanded, setIsExpanded] = useState(false);

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
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isExpanded]);

    const toggleExpand = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsExpanded(!isExpanded);
    };

    return (
        <div className={cn("relative group", containerClassName)}>
            {/* Expand Button - Visible only on mobile/small screens */}
            <button
                onClick={toggleExpand}
                className="absolute top-2 right-2 z-10 p-2 bg-background/80 hover:bg-background border border-border rounded-lg shadow-sm sm:hidden flex items-center justify-center transition-colors"
                title="Expand Graph"
            >
                <Maximize2 className="w-4 h-4 text-foreground" />
            </button>

            {/* Original Content */}
            {children}

            {/* Fullscreen Overlay */}
            {isExpanded && createPortal(
                <AnimatePresence>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9999] bg-background flex flex-col p-4 md:p-6"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold truncate pr-4">{title}</h3>
                            <button
                                onClick={toggleExpand}
                                className="p-2 bg-secondary hover:bg-secondary/80 rounded-full transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        
                        <div className="flex-1 w-full h-full min-h-0 relative">
                            {/* Re-render the children in the expanded container */}
                            {/* We clone to ensure ResponsiveContainer works correctly in the new context */}
                            <div className="w-full h-full">
                                {children}
                            </div>
                        </div>

                        {/* Recommendation for portrait users */}
                        <div className="mt-2 text-center sm:hidden">
                            <p className="text-xs text-muted-foreground animate-pulse">
                                Rotate your device for the best view
                            </p>
                        </div>
                    </motion.div>
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
};

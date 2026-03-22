import { useRef, useEffect } from 'react';
import { PRESET_COLORS } from '../utils/colors';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { useTranslation } from '../i18n';

interface ColorPickerPopoverProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (color: string) => void;
    onDelete?: () => void;
    position: { x: number; y: number };
}

export function ColorPickerPopover({ isOpen, onClose, onSelect, onDelete, position }: ColorPickerPopoverProps) {
    const { t } = useTranslation();
    const popoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                ref={popoverRef}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="fixed z-50 bg-popover border border-border rounded-lg shadow-xl p-3 w-64"
                style={{ top: position.y + 10, left: position.x }}
            >
                <div className="text-xs font-semibold mb-2 text-muted-foreground">{t('colorPickerTitle')}</div>
                <div className="grid grid-cols-5 gap-2 mb-4">
                    {PRESET_COLORS.map(color => (
                        <button
                            key={color}
                            onClick={() => {
                                onSelect(color);
                                onClose();
                            }}
                            className="w-8 h-8 rounded-full border border-border/50 hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                            style={{ backgroundColor: color }}
                            title={color}
                        />
                    ))}
                </div>
                {onDelete && (
                    <div className="pt-2 border-t border-border mt-2">
                        <button
                            onClick={() => {
                                onDelete();
                                onClose();
                            }}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-500 bg-red-500/10 hover:bg-red-500/20 rounded-md transition-colors"
                        >
                            <Trash2 size={16} />
                            {t('colorPickerDelete')}
                        </button>
                    </div>
                )}
            </motion.div>
        </AnimatePresence>
    );
}

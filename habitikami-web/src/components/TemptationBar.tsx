import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icons from 'lucide-react';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { habitService } from '../services/HabitService';
import { cn } from '../lib/utils';
import { useTranslation } from '../i18n';
import { toast } from 'sonner';

const IconRenderer = ({ name, size = 24, className = "" }: { name: string, size?: number, className?: string }) => {
  const IconComponent = (Icons as any)[name] || Icons.HelpCircle;
  return <IconComponent size={size} className={className} />;
};

export const TemptationBar = () => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [actionId, setActionId] = useState<string | null>(null);
  const [temptations, setTemptations] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    habitService.getTemptations().then(setTemptations);
  }, []);

  const activeTemptation = temptations[selectedIndex];

  const handleAction = async (action: any) => {
    setActionId(action.id);
    setStatus('loading');
    try {
      const result = await habitService.incrementCounter(action.id);
      if (result && result.error) {
        setStatus('error');
        toast.error(result.error);
        setTimeout(() => setStatus('idle'), 3000);
      } else {
        setStatus('success');
        toast.success(action.label || action.id, {
            description: action.type === 'negative' ? "you are the worste!" : "Great job!"
        });
        setTimeout(() => {
            setStatus('idle');
            // We don't necessarily want a full reload if it's a bar, 
            // but the parent might need to refresh data.
            // For now, let's trigger a custom event that App.tsx can listen to.
            window.dispatchEvent(new CustomEvent('habitDataChanged'));
        }, 2000);
      }
    } catch (e: any) {
      setStatus('error');
      toast.error(e.message || t('helpGenericError'));
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  if (temptations.length === 0) return null;

  return (
    <div className="w-full bg-card/40 backdrop-blur-xl border-b border-border/50 overflow-hidden relative">
      <div className="max-w-7xl mx-auto px-4 py-6 md:py-8">
        <div className="flex flex-col md:flex-row items-center gap-6 md:gap-12">
          
          {/* Label & Switcher */}
          <div className="flex flex-col items-center md:items-start space-y-2 shrink-0 min-w-[150px]">
            <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-400">
                {activeTemptation?.label}
            </h3>
            {temptations.length > 1 && (
                <div className="flex items-center gap-1 bg-secondary/30 p-1 rounded-full border border-border/50">
                    <button 
                        onClick={() => setSelectedIndex(prev => (prev - 1 + temptations.length) % temptations.length)}
                        className="p-1 hover:bg-white/5 rounded-full transition-colors"
                    >
                        <ChevronLeft size={16} className="text-muted-foreground" />
                    </button>
                    <span className="text-[10px] font-bold text-muted-foreground px-1 uppercase tracking-wider">
                        {selectedIndex + 1} / {temptations.length}
                    </span>
                    <button 
                         onClick={() => setSelectedIndex(prev => (prev + 1) % temptations.length)}
                         className="p-1 hover:bg-white/5 rounded-full transition-colors"
                    >
                        <ChevronRight size={16} className="text-muted-foreground" />
                    </button>
                </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex-1 flex flex-wrap justify-center md:justify-start items-center gap-4 md:gap-8">
            <AnimatePresence mode="wait">
              {activeTemptation?.actions.map((action: any) => (
                <motion.button
                  key={action.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.05, y: -4 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleAction(action)}
                  disabled={status === 'loading'}
                  className={cn(
                    "relative group flex flex-col items-center justify-center transition-all duration-300",
                    "w-24 h-24 md:w-32 md:h-32 rounded-3xl md:rounded-[2.5rem] border-2",
                    status === 'loading' && actionId === action.id ? "ring-4 ring-primary ring-offset-4 ring-offset-background" : "border-border/30 hover:border-primary/50 shadow-lg",
                    status === 'loading' && actionId !== action.id && "opacity-40 grayscale"
                  )}
                  style={{
                    background: `linear-gradient(135deg, ${action.color}22, ${action.color}11)`,
                    boxShadow: `0 20px 40px -20px ${action.color}66`
                  }}
                >
                  <div 
                    className="p-3 md:p-4 rounded-2xl mb-1 transition-transform group-hover:scale-110 duration-300"
                    style={{ backgroundColor: `${action.color}1a`, color: action.color }}
                  >
                    {status === 'loading' && actionId === action.id ? (
                      <Loader2 size={32} className="animate-spin" />
                    ) : (
                      <IconRenderer name={action.icon} size={32} className="md:w-10 md:h-10 drop-shadow-lg" />
                    )}
                  </div>
                  <span className="text-[10px] md:text-xs font-black uppercase tracking-tighter opacity-80 group-hover:opacity-100 transition-opacity">
                    {action.label}
                  </span>
                  
                  {/* Subtle pulsing background */}
                  <div 
                    className="absolute inset-0 rounded-3xl md:rounded-[2.5rem] -z-10 opacity-0 group-hover:opacity-10 transition-opacity duration-500 blur-xl"
                    style={{ backgroundColor: action.color }}
                  />
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
      
      {/* Decorative background accent */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] -z-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/5 blur-[100px] -z-10 pointer-events-none" />
    </div>
  );
};

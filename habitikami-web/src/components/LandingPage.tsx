import { motion } from 'framer-motion';
import { Sparkles, TrendingUp, Target, Zap, Github, Smartphone } from 'lucide-react';
import { useTranslation } from '../i18n';

interface LandingPageProps {
    onSignIn: () => void;
    isLoading?: boolean;
}

// Floating orb component
function FloatingOrb({
    size,
    color,
    initialX,
    initialY,
    duration,
    delay = 0,
}: {
    size: number;
    color: string;
    initialX: string;
    initialY: string;
    duration: number;
    delay?: number;
}) {
    return (
        <motion.div
            className="absolute rounded-full blur-3xl opacity-20 pointer-events-none"
            style={{
                width: size,
                height: size,
                background: color,
                left: initialX,
                top: initialY,
            }}
            animate={{
                x: [0, 30, -20, 10, 0],
                y: [0, -20, 15, -30, 0],
                scale: [1, 1.1, 0.95, 1.05, 1],
            }}
            transition={{
                duration,
                delay,
                repeat: Infinity,
                ease: 'easeInOut',
            }}
        />
    );
}

// Floating geometric shape
function FloatingShape({
    delay,
    x,
    y,
}: {
    delay: number;
    x: string;
    y: string;
}) {
    return (
        <motion.div
            className="absolute w-2 h-2 rounded-full pointer-events-none"
            style={{
                left: x,
                top: y,
                background: 'hsl(265 80% 60% / 0.4)',
                boxShadow: '0 0 8px hsl(265 80% 60% / 0.3)',
            }}
            animate={{
                y: [0, -40, 0],
                opacity: [0.2, 0.7, 0.2],
                scale: [0.8, 1.2, 0.8],
            }}
            transition={{
                duration: 4,
                delay,
                repeat: Infinity,
                ease: 'easeInOut',
            }}
        />
    );
}

// Feature card
function FeatureCard({
    icon: Icon,
    title,
    description,
    delay,
}: {
    icon: React.ElementType;
    title: string;
    description: string;
    delay: number;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay }}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm"
        >
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Icon className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground text-center leading-relaxed">
                {description}
            </p>
        </motion.div>
    );
}

export function LandingPage({ onSignIn, isLoading }: LandingPageProps) {
    const { t } = useTranslation();

    return (
        <div className="relative h-screen w-full overflow-hidden bg-background flex items-center justify-center">
            {/* ── Animated Gradient Orbs ── */}
            <FloatingOrb
                size={500}
                color="radial-gradient(circle, hsl(265 80% 50%), transparent)"
                initialX="-5%"
                initialY="10%"
                duration={12}
            />
            <FloatingOrb
                size={400}
                color="radial-gradient(circle, hsl(280 70% 45%), transparent)"
                initialX="60%"
                initialY="50%"
                duration={15}
                delay={2}
            />
            <FloatingOrb
                size={300}
                color="radial-gradient(circle, hsl(230 70% 50%), transparent)"
                initialX="30%"
                initialY="70%"
                duration={18}
                delay={4}
            />

            {/* ── Floating Particles ── */}
            {Array.from({ length: 12 }).map((_, i) => (
                <FloatingShape
                    key={i}
                    delay={i * 0.6}
                    x={`${8 + (i * 7.5) % 85}%`}
                    y={`${15 + ((i * 23) % 70)}%`}
                />
            ))}

            {/* ── Subtle grid overlay ── */}
            <div
                className="absolute inset-0 pointer-events-none opacity-[0.03]"
                style={{
                    backgroundImage:
                        'linear-gradient(hsl(265 80% 60%) 1px, transparent 1px), linear-gradient(90deg, hsl(265 80% 60%) 1px, transparent 1px)',
                    backgroundSize: '60px 60px',
                }}
            />

            {/* ── Main Content ── */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="relative z-10 flex flex-col items-center gap-8 px-6 max-w-lg w-full"
            >
                {/* Logo */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="relative"
                >
                    <div className="absolute inset-0 blur-2xl bg-primary/30 rounded-full scale-150" />
                    <img
                        src="/habitikami.png"
                        alt="Habitikami – Smart Habit Tracker App Logo"
                        className="relative w-20 h-20 md:w-24 md:h-24 drop-shadow-2xl"
                    />
                </motion.div>

                {/* Title */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.35 }}
                    className="text-center space-y-3"
                >
                    <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-purple-400 to-indigo-400">
                            Habitikami
                        </span>
                    </h1>
                    <p className="text-xs md:text-sm text-muted-foreground/60 italic tracking-wide">
                        {t('landingNameCaption')}
                    </p>
                    <p className="text-muted-foreground text-base md:text-lg font-medium max-w-sm mx-auto leading-relaxed">
                        {t('landingSubtitle')}
                    </p>
                </motion.div>

                {/* Glass Sign-In Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.5 }}
                    className="w-full max-w-sm"
                >
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-6 shadow-[0_8px_40px_hsl(265_80%_60%/0.12)]">
                        <div className="flex flex-col items-center gap-5">
                            <div className="flex items-center gap-2 text-muted-foreground text-sm">
                                <Sparkles className="w-4 h-4 text-primary" />
                                <span>{t('landingSignInPrompt')}</span>
                            </div>

                            <motion.button
                                onClick={onSignIn}
                                disabled={isLoading}
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                                className="w-full relative group flex items-center justify-center gap-3 py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-300 overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed"
                                style={{
                                    background:
                                        'linear-gradient(135deg, hsl(265 80% 55%), hsl(280 70% 50%), hsl(230 70% 55%))',
                                    color: 'white',
                                    boxShadow:
                                        '0 4px 20px hsl(265 80% 50% / 0.4), inset 0 1px 0 hsl(265 80% 70% / 0.3)',
                                }}
                            >
                                {/* Shimmer effect */}
                                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                                    <div
                                        className="absolute inset-0"
                                        style={{
                                            background:
                                                'linear-gradient(135deg, hsl(265 80% 60%), hsl(280 70% 55%), hsl(230 70% 60%))',
                                        }}
                                    />
                                </div>

                                <svg className="relative w-5 h-5" viewBox="0 0 24 24">
                                    <path
                                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                                        fill="#4285F4"
                                    />
                                    <path
                                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                        fill="#34A853"
                                    />
                                    <path
                                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                        fill="#FBBC05"
                                    />
                                    <path
                                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                        fill="#EA4335"
                                    />
                                </svg>
                                <span className="relative">
                                    {isLoading ? t('landingSigningIn') : t('landingSignInButton')}
                                </span>
                            </motion.button>

                            <p className="text-[11px] text-muted-foreground/50 text-center">
                                {t('landingDataNote')}
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* Feature Cards */}
                <div className="grid grid-cols-3 gap-3 w-full max-w-sm mt-2">
                    <FeatureCard
                        icon={Target}
                        title={t('landingFeatureTrackTitle')}
                        description={t('landingFeatureTrackDesc')}
                        delay={0.7}
                    />
                    <FeatureCard
                        icon={TrendingUp}
                        title={t('landingFeatureAnalyzeTitle')}
                        description={t('landingFeatureAnalyzeDesc')}
                        delay={0.85}
                    />
                    <FeatureCard
                        icon={Zap}
                        title={t('landingFeatureFocusTitle')}
                        description={t('landingFeatureFocusDesc')}
                        delay={1.0}
                    />
                </div>

                {/* Android App Tester Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 1.1 }}
                    className="w-full max-w-sm"
                >
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-6 shadow-[0_8px_40px_hsl(265_80%_60%/0.12)]">
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                                    <Smartphone className="w-4 h-4 text-primary" />
                                </div>
                                <h3 className="text-sm font-bold text-foreground">{t('landingAndroidTitle')}</h3>
                            </div>
                            
                            <p className="text-xs text-muted-foreground/80 leading-relaxed italic">
                                {t('landingAndroidSubtitle')}
                            </p>

                            <div className="space-y-3 mt-1">
                                <div className="flex flex-col gap-1">
                                    <a 
                                        href="https://groups.google.com/g/habitikam" 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-primary hover:underline text-xs font-semibold"
                                    >
                                        1. {t('landingAndroidStep1')}
                                    </a>
                                    <span className="text-[11px] text-muted-foreground/60 ml-4">
                                        {t('landingAndroidStep1Desc')}
                                    </span>
                                </div>
                                
                                <div className="flex flex-col gap-1">
                                    <a 
                                        href="https://play.google.com/apps/testing/dev.kambei.habitikami" 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-primary hover:underline text-xs font-semibold"
                                    >
                                        2. {t('landingAndroidStep2')}
                                    </a>
                                    <span className="text-[11px] text-muted-foreground/60 ml-4">
                                        {t('landingAndroidStep2Desc')}
                                    </span>
                                </div>
                            </div>

                            <p className="text-[10px] text-muted-foreground/40 leading-tight mt-2">
                                {t('landingAndroidFooter')}
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* Footer Links */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.8, delay: 1.2 }}
                    className="mt-6 flex items-center justify-center gap-6 text-[13px] text-muted-foreground"
                >
                    <a href="https://github.com/kambei/habitikami" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary transition-colors duration-200">
                        <Github className="w-3.5 h-3.5" />
                        GitHub
                    </a>
                    <span className="w-1 h-1 rounded-full bg-white/20"></span>
                    <a href="/privacy" className="hover:text-primary transition-colors duration-200">
                        {t('landingPrivacy')}
                    </a>
                    <span className="w-1 h-1 rounded-full bg-white/20"></span>
                    <a href="/terms" className="hover:text-primary transition-colors duration-200">
                        {t('landingTerms')}
                    </a>
                </motion.div>
            </motion.div>
        </div>
    );
}

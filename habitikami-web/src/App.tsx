import React, { useState, useEffect, useRef, Suspense } from 'react'
import type { SheetType, ViewType } from './types'
import { cn } from './lib/utils'
import { habitService } from './services/HabitService'
import { Toaster, toast } from 'sonner'
import { BottomNav } from './components/BottomNav'
import { AnimatePresence, motion } from 'framer-motion'
import { LayoutDashboard, Heart, Globe, Settings, Github } from 'lucide-react'
import { useTranslation } from './i18n'

const HabitTable = React.lazy(() => import('./components/HabitTable').then(m => ({ default: m.HabitTable })))
const Graphs = React.lazy(() => import('./components/Graphs').then(m => ({ default: m.Graphs })))
const CompactHabitView = React.lazy(() => import('./components/CompactHabitView').then(m => ({ default: m.CompactHabitView })))
const MobiusNotes = React.lazy(() => import('./components/MobiusNotes').then(m => ({ default: m.MobiusNotes })))
const SmokeTemptationView = React.lazy(() => import('./components/SmokeTemptationView').then(m => ({ default: m.SmokeTemptationView })))
const CountersView = React.lazy(() => import('./components/CountersView').then(m => ({ default: m.CountersView })))
const LandingPage = React.lazy(() => import('./components/LandingPage').then(m => ({ default: m.LandingPage })))
const OnboardingPage = React.lazy(() => import('./components/OnboardingPage').then(m => ({ default: m.OnboardingPage })))
const TabSelectionPage = React.lazy(() => import('./components/TabSelectionPage').then(m => ({ default: m.TabSelectionPage })))
const HelpView = React.lazy(() => import('./components/HelpView').then(m => ({ default: m.HelpView })))

const LoaderFallback = () => (
  <div className="absolute inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const ALL_TABS: ViewType[] = ['Weekdays', 'Weekend', 'Focus', 'Graphs', 'MobNotes', 'SmokeTemptation', 'Counters', 'Help'];

const TAB_LABEL_KEYS: Record<ViewType, string> = {
  Weekdays: 'tabWeekdays',
  Weekend: 'tabWeekend',
  Notes: 'tabNotes',
  Counters: 'tabCounters',
  Focus: 'tabFocus',
  Graphs: 'tabStats',
  MobNotes: 'tabNotes',
  SmokeTemptation: 'tabSmokeTemptation',
  Help: 'tabHelp',
};

function App() {
  const { t, language, setLanguage } = useTranslation();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  // email is set after auth; spreadsheetId null = needs onboarding
  const [email, setEmail] = useState<string | null>(null);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  // null = not loaded yet, string[] = loaded (may be all tabs if no prefs saved)
  const [enabledTabs, setEnabledTabs] = useState<ViewType[] | null>(null);
  // true while we fetch prefs after login
  const [isLoadingPrefs, setIsLoadingPrefs] = useState(false);
  // show tab selection UI (initial setup or edit from top bar)
  const [isEditingTabs, setIsEditingTabs] = useState(false);
  // default tab to open on startup (from server preferences)
  const [defaultTab, setDefaultTab] = useState<ViewType | null>(null);

  // Track whether the user arrived via an external link with a specific hash
  const [hadExternalHash] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    return !!(hash && ALL_TABS.includes(hash as ViewType));
  });

  const [activeSheet, setActiveSheet] = useState<ViewType>(() => {
    // 1. Check URL Hash
    const hash = window.location.hash.replace('#', '') as ViewType;
    if (hash && ALL_TABS.includes(hash)) return hash;

    // 2. Check local storage
    const saved = localStorage.getItem('habitikami_active_view');
    if (saved) return saved as ViewType;

    // 3. Default based on day
    const day = new Date().getDay();
    const isWeekend = day === 0 || day === 6; // 0=Sun, 6=Sat
    return isWeekend ? 'Weekend' : 'Weekdays';
  });

  const isMovingHistory = useRef(false);
  const lastBackTime = useRef(0);

  const [refreshKey, setRefreshKey] = useState(0);
  const [openSettings, setOpenSettings] = useState(false);

  // Persist view selection & sync to history
  useEffect(() => {
    localStorage.setItem('habitikami_active_view', activeSheet);

    if (!isMovingHistory.current) {
      if (history.state?.tab !== activeSheet) {
        history.pushState({ tab: activeSheet }, '', `#${activeSheet}`);
      }
    }
  }, [activeSheet]);

  // Back button handling & double-back-to-exit
  useEffect(() => {
    // Initial state: ensure we have at least one valid state at the start
    if (!history.state) {
      history.replaceState({ tab: activeSheet, isRoot: true }, '', `#${activeSheet}`);
    }

    const handlePopState = (e: PopStateEvent) => {
      if (e.state?.editingTabs) {
        setIsEditingTabs(true);
      } else if (e.state?.tab) {
        setIsEditingTabs(false);
        isMovingHistory.current = true;
        setActiveSheet(e.state.tab);
        setTimeout(() => {
          isMovingHistory.current = false;
        }, 50);
      } else {
        // We probably backed out of our history stack
        const now = Date.now();
        if (now - lastBackTime.current < 2000) {
          // Second back in 2s -> let it exit site
          history.back();
        } else {
          lastBackTime.current = now;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          toast.info(t('backToExit' as any), { duration: 2000 });
          // Guard state: push us back into the app flow
          history.pushState({ tab: activeSheet, isRoot: true }, '', `#${activeSheet}`);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeSheet, t]);

  const loadPreferences = async () => {
    setIsLoadingPrefs(true);
    try {
      const result = await habitService.getPreferences();
      if ('error' in result) {
        // Non-fatal: fall back to all tabs
        setEnabledTabs(ALL_TABS);
      } else if (result.enabled_tabs && result.enabled_tabs.length > 0) {
        const tabs = result.enabled_tabs.filter(t => ALL_TABS.includes(t as ViewType)) as ViewType[];
        // Always ensure 'Help' tab is available even if not saved previously
        if (!tabs.includes('Help')) {
          tabs.push('Help');
        }
        setEnabledTabs(tabs.length > 0 ? tabs : ALL_TABS);
        // Apply default tab — only skip if user arrived via an external link with a hash
        if (result.default_tab && ALL_TABS.includes(result.default_tab as ViewType)) {
          setDefaultTab(result.default_tab as ViewType);
          if (!hadExternalHash) {
            setActiveSheet(result.default_tab as ViewType);
          }
        }
      } else {
        // No prefs saved yet — show tab selection
        setEnabledTabs(null);
      }
    } catch {
      setEnabledTabs(ALL_TABS);
    } finally {
      setIsLoadingPrefs(false);
    }
  };

  useEffect(() => {
    habitService.tryRestoreSession().then(async restored => {
      if (restored) {
        setEmail(habitService.getEmail());
        setSpreadsheetId(habitService.getStoredSpreadsheetId());
        setIsLoggedIn(true);
        handleRefresh();
        await loadPreferences();
      }
      setIsCheckingSession(false);
    });
  }, []);

  const handleAuth = async () => {
    const result = await habitService.auth();
    if (result?.error) {
      toast.error("Sign-in failed: " + result.error);
    } else {
      setEmail(habitService.getEmail());
      setSpreadsheetId(habitService.getStoredSpreadsheetId());
      setIsLoggedIn(true);
      handleRefresh();
      await loadPreferences();
    }
  };

  const handleLogout = () => {
    habitService.clearSession();
    setIsLoggedIn(false);
    setEmail(null);
    setSpreadsheetId(null);
    setEnabledTabs(null);
    setIsEditingTabs(false);
  };

  const handleTabSelectionComplete = (tabs: ViewType[], newDefaultTab?: ViewType) => {
    // Always ensure 'Help' tab is available
    if (!tabs.includes('Help')) {
      tabs = [...tabs, 'Help'];
    }
    setEnabledTabs(tabs);
    setDefaultTab(newDefaultTab ?? null);
    setIsEditingTabs(false);
    if (history.state?.editingTabs) {
      history.back();
    }
    // If active tab was disabled, switch to first enabled
    if (!tabs.includes(activeSheet)) {
      setActiveSheet(tabs[0]);
    }
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'it' : 'en');
  };

  // Don't render anything while checking session or loading prefs (avoid flash)
  if (isCheckingSession || isLoadingPrefs) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"
        />
      </div>
    );
  }

  // Tabs to show — null means prefs not loaded yet (shouldn't reach here due to isLoadingPrefs guard)
  const visibleTabs = enabledTabs ?? ALL_TABS;

  return (
    <AnimatePresence mode="wait">
      {!isLoggedIn ? (
        <motion.div
          key="landing"
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3 }}
        >
          <Suspense fallback={<LoaderFallback />}>
            <LandingPage onSignIn={handleAuth} />
          </Suspense>
        </motion.div>
      ) : !spreadsheetId ? (
        <motion.div
          key="onboarding"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Suspense fallback={<LoaderFallback />}>
            <OnboardingPage
              email={email ?? ''}
              onComplete={(id: string) => setSpreadsheetId(id)}
            />
          </Suspense>
          <Toaster position="top-center" theme="dark" />
        </motion.div>
      ) : (enabledTabs === null || isEditingTabs) ? (
        <motion.div
          key="tab-selection"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Suspense fallback={<LoaderFallback />}>
            <TabSelectionPage
              currentTabs={enabledTabs ?? undefined}
              currentDefaultTab={defaultTab}
              onComplete={handleTabSelectionComplete}
              onCancel={isEditingTabs ? () => setIsEditingTabs(false) : undefined}
            />
          </Suspense>
          <Toaster position="top-center" theme="dark" />
        </motion.div>
      ) : (
        <motion.div
          key="dashboard"
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="h-screen bg-background text-foreground flex flex-col font-sans overflow-hidden"
        >
          <header className="p-2 md:p-4 border-b border-border bg-card/50 backdrop-blur shrink-0 z-20">
            <div className="w-full max-w-7xl mx-auto px-2 md:px-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-400">
                  Habitikami
                </h1>
                <a
                  href="https://ko-fi.com/kambei"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-full bg-secondary text-rose-400 hover:bg-rose-500/20 flex items-center justify-center transition-colors shadow-sm shrink-0"
                  title={t('tooltipKofi')}
                >
                  <Heart width={16} height={16} />
                </a>
                <div className="relative group">
                  <button
                    className="w-8 h-8 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 flex items-center justify-center transition-colors shadow-sm shrink-0"
                    title="GitHub"
                  >
                    <Github width={16} height={16} />
                  </button>
                  <div className="absolute left-0 top-full mt-1 hidden group-hover:flex flex-col bg-card border border-border rounded-lg shadow-lg p-2 min-w-[180px] z-50">
                    <a
                      href="https://github.com/kambei/habitikami"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded hover:bg-secondary/50 transition-colors"
                    >
                      View on GitHub
                    </a>
                    <a
                      href="https://github.com/kambei/habitikami/issues/new"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded hover:bg-secondary/50 transition-colors"
                    >
                      Report an issue
                    </a>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4 w-full md:w-auto">
                {/* Top Nav - Hidden on Mobile */}
                <div className="hidden md:flex bg-secondary/20 p-1 rounded-lg border border-border overflow-x-auto max-w-full">
                  {visibleTabs.map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveSheet(tab)}
                      className={cn(
                        "px-3 py-1.5 md:px-4 md:py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap",
                        activeSheet === tab
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                      )}
                    >
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {t(TAB_LABEL_KEYS[tab] as any)}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  {email && (
                    <span className="hidden md:block text-xs text-muted-foreground truncate max-w-[160px]" title={email}>
                      {email}
                    </span>
                  )}
                  {/* Settings */}
                  <button
                    onClick={() => {
                      setActiveSheet('Help');
                      setOpenSettings(true);
                    }}
                    className="w-8 h-8 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 flex items-center justify-center transition-colors shadow-sm shrink-0"
                    title={t('tooltipSettings')}
                  >
                    <Settings width={16} height={16} />
                  </button>
                  {/* Language Toggle */}
                  <button
                    onClick={toggleLanguage}
                    className="w-8 h-8 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 flex items-center justify-center transition-colors shadow-sm shrink-0 text-xs font-bold"
                    title={t('tooltipLanguage')}
                  >
                    <Globe width={16} height={16} />
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingTabs(true);
                      history.pushState({ editingTabs: true }, '', '#edit-tabs');
                    }}
                    className="w-8 h-8 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 flex items-center justify-center transition-colors shadow-sm shrink-0"
                    title={t('tooltipCustomize')}
                  >
                    <LayoutDashboard width={16} height={16} />
                  </button>
                  <button
                    onClick={handleRefresh}
                    className="w-8 h-8 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 flex items-center justify-center transition-colors shadow-sm shrink-0"
                    title={t('tooltipRefresh')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 21h5v-5" /></svg>
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-8 h-8 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 flex items-center justify-center transition-colors shadow-sm shrink-0"
                    title={t('tooltipSignOut')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  </button>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 p-4 w-full h-full overflow-hidden flex flex-col pb-24 md:pb-4">
            <div className="bg-card rounded-xl border border-border shadow-2xl overflow-hidden flex-1 flex flex-col relative">
              <Suspense fallback={<LoaderFallback />}>
                {activeSheet === 'Graphs' ? (
                  <Graphs />
                ) : activeSheet === 'Focus' ? (
                  <CompactHabitView refreshKey={refreshKey} />
                ) : activeSheet === 'MobNotes' ? (
                  <MobiusNotes />
                ) : activeSheet === 'SmokeTemptation' ? (
                  <SmokeTemptationView />
                ) : activeSheet === 'Counters' ? (
                  <CountersView />
                ) : activeSheet === 'Help' ? (
                  <HelpView openSettings={openSettings} onSettingsClosed={() => setOpenSettings(false)} />
                ) : (
                  <HabitTable sheetName={activeSheet as SheetType} key={activeSheet} refreshKey={refreshKey} />
                )}
              </Suspense>
            </div>
          </main>

          <BottomNav 
            key={visibleTabs.join(',')} 
            activeTab={activeSheet} 
            onTabChange={setActiveSheet} 
            enabledTabs={visibleTabs} 
          />
          <Toaster position="top-center" theme="dark" />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default App

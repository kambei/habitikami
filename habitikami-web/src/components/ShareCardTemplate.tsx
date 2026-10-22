/** Three 1080×1080 card layouts rendered off-screen by utils/shareCard.ts. */
export type ShareCardSpec =
    | { template: 'streak'; title: string; habit: string; days: number; daysLabel: string; footer: string; color?: string }
    | { template: 'rate'; title: string; rate: number; periodLabel: string; subtitle: string; footer: string }
    | { template: 'achievement'; title: string; icon: string; name: string; description: string; footer: string };

const BASE: React.CSSProperties = {
    width: 1080, height: 1080, boxSizing: 'border-box', padding: 96, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Color Emoji", sans-serif', color: '#f8fafc',
};
const BRAND = '🏯 Habitikami';

export function ShareCardTemplate({ spec }: { spec: ShareCardSpec }) {
    if (spec.template === 'streak') {
        const color = spec.color || '#f59e0b';
        return (
            <div style={{ ...BASE, background: `radial-gradient(circle at 20% 20%, ${color}55, transparent 55%), linear-gradient(160deg, #0f172a, #1e1b4b)` }}>
                <div style={{ fontSize: 40, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.8 }}>{spec.title}</div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 200, lineHeight: 1 }}>🔥</div>
                    <div style={{ fontSize: 220, fontWeight: 800, lineHeight: 1, color, marginTop: 16 }}>{spec.days}</div>
                    <div style={{ fontSize: 56, opacity: 0.85, marginTop: 8 }}>{spec.daysLabel}</div>
                    <div style={{ fontSize: 72, fontWeight: 700, marginTop: 40, wordBreak: 'break-word' }}>{spec.habit}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 40, opacity: 0.8 }}><span>{BRAND}</span><span>{spec.footer}</span></div>
            </div>
        );
    }
    if (spec.template === 'rate') {
        const r = 300, c = 2 * Math.PI * r, pct = Math.max(0, Math.min(100, spec.rate));
        return (
            <div style={{ ...BASE, background: 'linear-gradient(160deg, #052e16, #0f172a 60%, #1e1b4b)' }}>
                <div style={{ fontSize: 40, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.8 }}>{spec.title}</div>
                <div style={{ textAlign: 'center', position: 'relative' }}>
                    <svg width={720} height={720} viewBox="0 0 720 720" style={{ display: 'block', margin: '0 auto' }}>
                        <circle cx={360} cy={360} r={r} stroke="#ffffff22" strokeWidth={48} fill="none" />
                        <circle cx={360} cy={360} r={r} stroke="#34d399" strokeWidth={48} fill="none" strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 360 360)" />
                        <text x={360} y={340} textAnchor="middle" fontSize={200} fontWeight={800} fill="#f8fafc">{pct}%</text>
                        <text x={360} y={430} textAnchor="middle" fontSize={48} fill="#cbd5e1">{spec.periodLabel}</text>
                    </svg>
                    <div style={{ fontSize: 48, opacity: 0.9, marginTop: 8 }}>{spec.subtitle}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 40, opacity: 0.8 }}><span>{BRAND}</span><span>{spec.footer}</span></div>
            </div>
        );
    }
    return (
        <div style={{ ...BASE, background: 'radial-gradient(circle at 50% 30%, #7c3aed66, transparent 55%), linear-gradient(160deg, #1e1b4b, #0f172a)' }}>
            <div style={{ fontSize: 40, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.8 }}>{spec.title}</div>
            <div style={{ textAlign: 'center' }}>
                <div style={{ width: 420, height: 420, borderRadius: 210, margin: '0 auto', background: '#ffffff14', border: '12px solid #a78bfa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 240, lineHeight: 1 }}>{spec.icon}</div>
                <div style={{ fontSize: 88, fontWeight: 800, marginTop: 48 }}>{spec.name}</div>
                <div style={{ fontSize: 48, opacity: 0.85, marginTop: 16 }}>{spec.description}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 40, opacity: 0.8 }}><span>{BRAND}</span><span>{spec.footer}</span></div>
        </div>
    );
}

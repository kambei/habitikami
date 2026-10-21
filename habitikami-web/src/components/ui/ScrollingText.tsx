import { useLayoutEffect, useRef, useState } from 'react';

interface Props {
    text: string;
    className?: string;
    /** Scroll speed in px per second. */
    speed?: number;
}

/**
 * Single-line text that stays put when it fits and, when it overflows its
 * box, glides back and forth slowly with a pause at each end (marquee style,
 * but only where needed). Falls back to an ellipsis when the user prefers
 * reduced motion (see `.scroll-text` in index.css).
 */
export function ScrollingText({ text, className = '', speed = 25 }: Props) {
    const outer = useRef<HTMLSpanElement>(null);
    const inner = useRef<HTMLSpanElement>(null);
    const [overflow, setOverflow] = useState(0);

    useLayoutEffect(() => {
        const o = outer.current;
        const i = inner.current;
        if (!o || !i || typeof ResizeObserver === 'undefined') return;
        // ResizeObserver fires once on observe(), which also measures the initial layout
        const ro = new ResizeObserver(() => setOverflow(Math.max(0, i.scrollWidth - o.clientWidth)));
        ro.observe(o);
        ro.observe(i);
        return () => ro.disconnect();
    }, [text]);

    // The keyframes move during 30% of the cycle each way; the rest is pauses
    const duration = Math.max(4, overflow / speed / 0.3);

    return (
        <span
            ref={outer}
            className={`block min-w-0 overflow-hidden whitespace-nowrap ${overflow > 0 ? 'scroll-text' : 'truncate'} ${className}`}
            title={text}
        >
            <span
                ref={inner}
                className="inline-block"
                style={overflow > 0 ? { ['--scroll-x' as string]: `-${overflow}px`, animationDuration: `${duration}s` } : undefined}
            >
                {text}
            </span>
        </span>
    );
}

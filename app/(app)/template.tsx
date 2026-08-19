"use client"
import {useEffect} from "react"

// Page-enter transition between subpages: Next re-mounts the template (unique key per navigation),
// so this wrapper's CSS animation re-runs each time, fading + rising the new page in. CSS (not a
// Motion mount animation, which stalls on a fresh mount in dev) so it runs reliably on the
// compositor; the global prefers-reduced-motion reset neutralises it. The sidebar (layout.tsx) stays.
// The FIRST mount after a full document load skips the animation - on F5 the 6px rise reads as a
// glitchy vertical jump of the whole page, not a transition. The module flag is written in an
// effect (client-only, render stays pure) and survives soft navigations, so every later template
// mount animates.
let hasNavigated = false

export default function Template({children}: {children: React.ReactNode}) {
	const animate = hasNavigated
	useEffect(() => {
		hasNavigated = true
	}, [])
	return <div className={animate ? "motion-safe:[animation:pageIn_180ms_var(--ease-out-quart)_both]" : undefined}>{children}</div>
}

// app/(app)/template.tsx
// Page-enter transition between subpages: Next re-mounts the template (unique key per navigation),
// so this wrapper's CSS animation re-runs each time, fading + rising the new page in. CSS (not a
// Motion mount animation, which stalls on a fresh mount in dev) so it runs reliably on the
// compositor; the global prefers-reduced-motion reset neutralises it. The sidebar (layout.tsx) stays.
export default function Template({children}: {children: React.ReactNode}) {
	return <div className="motion-safe:[animation:pageIn_180ms_var(--ease-out-quart)_both]">{children}</div>
}

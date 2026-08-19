"use client"
import {useEffect, useRef, useState} from "react"
import {motion, useReducedMotion} from "motion/react"
import {cn} from "@/lib/cn"
import {buildSparklinePath, type DailyCount} from "@/features/metrics/compute"
import {EASE_OUT_QUART} from "@/lib/motion"

// Sparkline reveal: a clip-path spring wipe on the WRAPPER, so line, gradient area and end dot
// reveal together as one scene (.spark-wipe in globals.css - a bounce:0 spring baked into a CSS
// linear() curve; springs start at zero velocity, which is what keeps the entrance calm where any
// ease-out reads aggressive). Pure CSS, no JS animation: the old Motion-driven reveal ran on the
// main thread and dev StrictMode could interrupt it leaving the chart hidden - CSS at worst
// restarts, and the clipped state lives only inside the keyframes, so with animations unavailable
// the chart renders complete; reduced motion finishes instantly via the global reset.
// The path is built at the MEASURED pixel width (ResizeObserver + hidden-tab timer fallback) so
// the viewBox maps 1:1 to screen - preserveAspectRatio="none" at non-uniform scale distorts stroke
// and any SVG circle (the end dot stays an HTML overlay for the same reason).
const SPARK_H = 64

export function Sparkline({className, daily}: {className?: string; daily: DailyCount[]}) {
	const ref = useRef<HTMLDivElement>(null)
	const [width, setWidth] = useState(0)
	useEffect(() => {
		const el = ref.current
		if (!el) return
		const ro = new ResizeObserver((entries) => setWidth(Math.round(entries[0].contentRect.width)))
		ro.observe(el)
		// ResizeObserver never fires in hidden documents (background tab); measure once via a timer too.
		const t = setTimeout(() => setWidth((w) => w || Math.round(el.clientWidth)), 0)
		return () => {
			ro.disconnect()
			clearTimeout(t)
		}
	}, [])
	const {line, area, end} = width > 0 ? buildSparklinePath(daily.map((d) => d.count), width, SPARK_H) : {line: "", area: "", end: null}
	return (
		<div className={cn("relative", line && "spark-wipe", className)} ref={ref}>
			{line ? (
				<svg className="h-full w-full" viewBox={`0 0 ${width} ${SPARK_H}`} preserveAspectRatio="none" role="img" aria-label="Wysłane maile dziennie, ostatnie 30 dni">
					<defs>
						<linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0" stopColor="var(--text)" stopOpacity=".12" />
							<stop offset="1" stopColor="var(--text)" stopOpacity="0" />
						</linearGradient>
					</defs>
					<path d={area} fill="url(#spark-fill)" />
					<path d={line} fill="none" stroke="var(--text)" strokeWidth="1.5" />
				</svg>
			) : null}
			{end ? (
				<span
					className="absolute size-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg"
					style={{left: `${(end.x / width) * 100}%`, top: `${(end.y / SPARK_H) * 100}%`}}
					aria-hidden
				/>
			) : null}
		</div>
	)
}

export function FunnelRow({label, count, max, tone = "neutral", index = 0}: {label: string; count: number; max: number; tone?: "neutral" | "won" | "lost"; index?: number}) {
	const reduce = useReducedMotion()
	const raw = max > 0 ? (count / max) * 100 : 0
	const pct = count > 0 ? Math.max(1.5, Math.round(raw * 10) / 10) : 0
	const fill = tone === "won" ? "bg-success" : tone === "lost" ? "bg-danger/55" : "bg-fg-muted"
	return (
		<div className="grid grid-cols-[88px_1fr_44px] items-center gap-2.5 py-[5px] text-[12.5px]">
			<span className="text-fg-muted">{label}</span>
			<span className="relative h-[3px] overflow-hidden rounded-full bg-surface-3">
				<motion.span className={cn("absolute inset-y-0 left-0 origin-left rounded-full", fill)} style={{width: `${pct}%`}} initial={reduce ? false : {scaleX: 0}} animate={{scaleX: 1}} transition={{duration: 0.7, delay: index * 0.09, ease: EASE_OUT_QUART}} />
			</span>
			<span className="text-right text-xs tabular-nums text-fg">{count}</span>
		</div>
	)
}

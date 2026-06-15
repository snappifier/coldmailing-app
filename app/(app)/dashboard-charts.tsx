"use client"
// app/(app)/dashboard-charts.tsx
import {motion, useReducedMotion} from "motion/react"
import {cn} from "@/lib/cn"
import {buildSparklinePath, type DailyCount} from "@/features/metrics/compute"
import {EASE_OUT_QUART} from "@/lib/motion"

// Sparkline: the line draws in once via pathLength; the area fades in. Static after mount.
export function Sparkline({className, daily}: {className?: string; daily: DailyCount[]}) {
	const reduce = useReducedMotion()
	const {line, area, end} = buildSparklinePath(daily.map((d) => d.count), 600, 64)
	if (!line) return null
	return (
		<svg className={className} viewBox="0 0 600 64" preserveAspectRatio="none" role="img" aria-label="Wysłane maile dziennie, ostatnie 30 dni">
			<defs>
				<linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0" stopColor="var(--text)" stopOpacity=".12" />
					<stop offset="1" stopColor="var(--text)" stopOpacity="0" />
				</linearGradient>
			</defs>
			<motion.path d={area} fill="url(#spark-fill)" initial={reduce ? false : {opacity: 0}} animate={{opacity: 1}} transition={{duration: 0.6, delay: 0.12, ease: "easeOut"}} />
			<motion.path d={line} fill="none" stroke="var(--text)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" initial={reduce ? false : {pathLength: 0}} animate={{pathLength: 1}} transition={{duration: 0.6, ease: EASE_OUT_QUART}} />
			{end ? <circle cx={end.x} cy={end.y} r="2.5" fill="var(--text)" /> : null}
		</svg>
	)
}

export function FunnelRow({label, count, max, tone = "neutral"}: {label: string; count: number; max: number; tone?: "neutral" | "won" | "lost"}) {
	const reduce = useReducedMotion()
	const raw = max > 0 ? (count / max) * 100 : 0
	const pct = count > 0 ? Math.max(1.5, Math.round(raw * 10) / 10) : 0
	const fill = tone === "won" ? "bg-success" : tone === "lost" ? "bg-danger/55" : "bg-fg-muted"
	return (
		<div className="grid grid-cols-[88px_1fr_44px] items-center gap-2.5 py-[5px] text-[12.5px]">
			<span className="text-fg-muted">{label}</span>
			<span className="relative h-[3px] overflow-hidden rounded-full bg-surface-3">
				<motion.span className={cn("absolute inset-y-0 left-0 origin-left rounded-full", fill)} style={{width: `${pct}%`}} initial={reduce ? false : {scaleX: 0}} animate={{scaleX: 1}} transition={{duration: 0.5, ease: EASE_OUT_QUART}} />
			</span>
			<span className="text-right text-xs tabular-nums text-fg">{count}</span>
		</div>
	)
}

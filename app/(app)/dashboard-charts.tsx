"use client"
// app/(app)/dashboard-charts.tsx
import {motion, useReducedMotion} from "motion/react"
import {cn} from "@/lib/cn"
import {buildSparklinePath, type DailyCount} from "@/features/metrics/compute"
import {EASE_OUT_QUART} from "@/lib/motion"

// Sparkline: line + gradient reveal together once via a single clip-path wipe (left -> right),
// then static. clip-path animates on the compositor (cheaper than the per-frame stroke-dashoffset
// repaint); reduced motion renders the final, unclipped state.
export function Sparkline({className, daily}: {className?: string; daily: DailyCount[]}) {
	const reduce = useReducedMotion()
	const {line, area, end} = buildSparklinePath(daily.map((d) => d.count), 600, 64)
	if (!line) return null
	return (
		<motion.svg
			className={className}
			viewBox="0 0 600 64"
			preserveAspectRatio="none"
			role="img"
			aria-label="Wysłane maile dziennie, ostatnie 30 dni"
			initial={reduce ? false : {clipPath: "inset(0px 100% 0px 0px)"}}
			animate={{clipPath: "inset(0px 0% 0px 0px)"}}
			transition={{duration: 1.4, ease: EASE_OUT_QUART}}
		>
			<defs>
				<linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0" stopColor="var(--text)" stopOpacity=".12" />
					<stop offset="1" stopColor="var(--text)" stopOpacity="0" />
				</linearGradient>
			</defs>
			<path d={area} fill="url(#spark-fill)" />
			<path d={line} fill="none" stroke="var(--text)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
			{end ? <circle cx={end.x} cy={end.y} r="2.5" fill="var(--text)" /> : null}
		</motion.svg>
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

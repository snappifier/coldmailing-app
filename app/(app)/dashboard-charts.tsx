"use client"
import {useEffect, useRef, useState} from "react"
import {AnimatePresence, motion, useReducedMotion} from "motion/react"
import {cn} from "@/lib/cn"
import {buildSparklinePath, formatInt, type DailyCount} from "@/features/metrics/compute"
import {EASE_OUT_QUART, SPRING_SETTLE} from "@/lib/motion"

const DAY_LABEL = new Intl.DateTimeFormat("pl-PL", {day: "numeric", month: "short"})
const WEEKDAY_LABEL = new Intl.DateTimeFormat("pl-PL", {weekday: "short"})

function dayLabel(iso: string): string {
	const d = new Date(`${iso}T12:00:00`)
	return `${DAY_LABEL.format(d)} · ${WEEKDAY_LABEL.format(d)}`
}

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
// LIVE updates (the pulpit refreshes every 30s): line, area and dot MORPH to the new data via
// motion.path d-interpolation (native, since every build has the same 30-point path structure) -
// initial={false} keeps the mount reveal to the wipe alone.
const SPARK_H = 64
const MORPH = {duration: 0.5, ease: EASE_OUT_QUART} as const

export function Sparkline({className, daily}: {className?: string; daily: DailyCount[]}) {
	const reduce = useReducedMotion()
	const ref = useRef<HTMLDivElement>(null)
	const [width, setWidth] = useState(0)
	const [hover, setHover] = useState<number | null>(null)
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
	const {line, area, points, end} = width > 0 ? buildSparklinePath(daily.map((d) => d.count), width, SPARK_H) : {line: "", area: "", points: [], end: null}
	const snap = reduce ? {duration: 0} : SPRING_SETTLE
	const hovered = hover !== null && points[hover] ? {pt: points[hover], day: daily[hover]} : null

	function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
		if (points.length < 2) return
		const rect = e.currentTarget.getBoundingClientRect()
		const stepX = width / (points.length - 1)
		setHover(Math.min(points.length - 1, Math.max(0, Math.round((e.clientX - rect.left) / stepX))))
	}

	// The wipe (clip-path on the INNER div) would crop the tooltip poking above the chart, so the
	// hover layer lives on the outer, unclipped container.
	return (
		<div className={cn("relative", className)} ref={ref} onPointerMove={onPointerMove} onPointerLeave={() => setHover(null)}>
			<div className={cn("h-full w-full", line && "spark-wipe")}>
				{line ? (
					<svg className="h-full w-full" viewBox={`0 0 ${width} ${SPARK_H}`} preserveAspectRatio="none" role="img" aria-label="Wysłane maile dziennie, ostatnie 30 dni">
						<defs>
							<linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
								<stop offset="0" stopColor="var(--text)" stopOpacity=".12" />
								<stop offset="1" stopColor="var(--text)" stopOpacity="0" />
							</linearGradient>
						</defs>
						<motion.path initial={false} animate={{d: area}} transition={reduce ? {duration: 0} : MORPH} fill="url(#spark-fill)" />
						<motion.path initial={false} animate={{d: line}} transition={reduce ? {duration: 0} : MORPH} fill="none" stroke="var(--text)" strokeWidth="1.5" />
					</svg>
				) : null}
				{end ? (
					<motion.span
						className="absolute size-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg"
						initial={false}
						animate={{left: `${(end.x / width) * 100}%`, top: `${(end.y / SPARK_H) * 100}%`}}
						transition={reduce ? {duration: 0} : MORPH}
						aria-hidden
					/>
				) : null}
			</div>
			<AnimatePresence>
				{hovered ? (
					<motion.div className="pointer-events-none absolute inset-y-0 left-0 w-full" initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} transition={{duration: 0.12}} aria-hidden>
						<motion.span className="absolute inset-y-0 w-px bg-border-strong" initial={false} animate={{left: hovered.pt.x}} transition={snap} />
						<motion.span
							className="absolute size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface-1 bg-fg"
							initial={false}
							animate={{left: hovered.pt.x, top: hovered.pt.y}}
							transition={snap}
						/>
						<motion.div
							className="absolute bottom-[calc(100%+8px)] -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface-1 px-2.5 py-1.5 shadow-pop"
							initial={false}
							animate={{left: Math.min(Math.max(hovered.pt.x, 56), Math.max(width - 56, 56))}}
							transition={snap}
						>
							<div className="flex items-center gap-1.5 text-[11.5px] text-fg-muted">
								<span className="size-[5px] rounded-full bg-fg" />
								Wysłane <span className="font-semibold tabular-nums text-fg">{formatInt(hovered.day.count)}</span>
							</div>
							<div className="mt-0.5 text-[10.5px] text-fg-faint">{dayLabel(hovered.day.date)}</div>
						</motion.div>
					</motion.div>
				) : null}
			</AnimatePresence>
		</div>
	)
}

export function FunnelRow({label, count, max, tone = "neutral", index = 0, delay = 0}: {label: string; count: number; max: number; tone?: "neutral" | "won" | "lost"; index?: number; delay?: number}) {
	const reduce = useReducedMotion()
	const raw = max > 0 ? (count / max) * 100 : 0
	const pct = count > 0 ? Math.max(1.5, Math.round(raw * 10) / 10) : 0
	const fill = tone === "won" ? "bg-success" : tone === "lost" ? "bg-danger/55" : "bg-fg-muted"
	return (
		<div className="grid grid-cols-[88px_1fr_44px] items-center gap-2.5 py-[5px] text-[12.5px]">
			<span className="text-fg-muted">{label}</span>
			<span className="relative h-[3px] overflow-hidden rounded-full bg-surface-3">
				<motion.span className={cn("absolute inset-y-0 left-0 origin-left rounded-full transition-[width] duration-500 ease-out", fill)} style={{width: `${pct}%`}} initial={reduce ? false : {scaleX: 0}} animate={{scaleX: 1}} transition={{duration: 0.7, delay: delay + index * 0.09, ease: EASE_OUT_QUART}} />
			</span>
			<span className="text-right text-xs tabular-nums text-fg">{count}</span>
		</div>
	)
}

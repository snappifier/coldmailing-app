// app/(app)/dashboard-parts.tsx
import Link from "next/link"
import {cn} from "@/lib/cn"
import {ArrowRightIcon} from "@/components/ui/icons"
import {buildSparklinePath, relativeTimePl, type DailyCount} from "@/features/metrics/compute"
import type {RecentReply} from "@/features/metrics/queries"

export function MetricStat({label, value}: {label: string; value: string}) {
	return (
		<div className="flex flex-col">
			<span className="text-xs text-fg-muted">{label}</span>
			<span className="text-base font-semibold tabular-nums">{value}</span>
		</div>
	)
}

export function HeroStat({label, value, sub}: {label: string; value: string; sub?: React.ReactNode}) {
	return (
		<div className="flex flex-col px-5 py-4">
			<span className="text-[10px] font-semibold uppercase tracking-[.06em] text-fg-faint">{label}</span>
			<span className="mt-1 text-[26px] font-semibold leading-tight tracking-[-0.03em] tabular-nums">{value}</span>
			{sub ? <span className="mt-0.5 text-[11px] text-fg-faint">{sub}</span> : null}
		</div>
	)
}

export function HealthStat({color, label, value}: {color: string; label: string; value: string}) {
	return (
		<span className="inline-flex items-center gap-1.5 text-[11.5px] text-fg-muted">
			<span className={cn("size-[5px] rounded-full", color)} />
			{label} <span className="tabular-nums text-fg">{value}</span>
		</span>
	)
}

// Server-rendered area sparkline; the slight x-stretch of the end dot under
// preserveAspectRatio="none" is accepted (matches the approved mock).
export function Sparkline({className, daily}: {className?: string; daily: DailyCount[]}) {
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
			<path d={area} fill="url(#spark-fill)" />
			<path d={line} fill="none" stroke="var(--text)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
			{end ? <circle cx={end.x} cy={end.y} r="2.5" fill="var(--text)" /> : null}
		</svg>
	)
}

export function FunnelRow({label, count, max, tone = "neutral"}: {label: string; count: number; max: number; tone?: "neutral" | "won" | "lost"}) {
	const raw = max > 0 ? (count / max) * 100 : 0
	const pct = count > 0 ? Math.max(1.5, Math.round(raw * 10) / 10) : 0
	const fill = tone === "won" ? "bg-success" : tone === "lost" ? "bg-danger/55" : "bg-fg-muted"
	return (
		<div className="grid grid-cols-[88px_1fr_44px] items-center gap-2.5 py-[5px] text-[12.5px]">
			<span className="text-fg-muted">{label}</span>
			<span className="relative h-[3px] overflow-hidden rounded-full bg-surface-3">
				<span className={cn("absolute inset-y-0 left-0 rounded-full", fill)} style={{width: `${pct}%`}} />
			</span>
			<span className="text-right text-xs tabular-nums text-fg">{count}</span>
		</div>
	)
}

export function ReplyRow({reply, now}: {reply: RecentReply; now: Date}) {
	const initials = reply.organizationName.trim().slice(0, 2).toUpperCase()
	return (
		<Link className="group flex items-center gap-2.5 border-b border-border/60 py-[7px] text-[12.5px] transition-colors last:border-b-0 hover:bg-surface-2/50" href={`/kampanie/${reply.campaignId}`}>
			<span className="grid size-[22px] flex-none place-items-center rounded-full border border-border bg-surface-2 text-[9px] font-bold text-fg-muted">{initials}</span>
			<span className="min-w-0 flex-1">
				<span className="block truncate font-medium text-fg">{reply.organizationName}</span>
				<span className="block truncate text-[11px] text-fg-faint">{reply.campaignName}</span>
			</span>
			<span className="flex-none text-[11px] text-fg-faint">{relativeTimePl(reply.at, now)}</span>
			<ArrowRightIcon className="size-3.5 flex-none -translate-x-0.5 text-fg-faint opacity-0 transition-[opacity,transform] duration-150 ease-out group-hover:translate-x-0.5 group-hover:text-fg group-hover:opacity-100" />
		</Link>
	)
}

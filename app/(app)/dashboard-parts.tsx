// app/(app)/dashboard-parts.tsx
import {cn} from "@/lib/cn"
import type {DealStage} from "@/generated/prisma/client"

const TONE: Record<string, string> = {up: "text-success", warn: "text-warning", bad: "text-danger", muted: "text-fg-faint"}

export function Kpi({label, value, sub, tone = "muted"}: {label: string; value: string; sub?: string; tone?: "up" | "warn" | "bad" | "muted"}) {
	return (
		<div className="flex flex-col gap-1 rounded-lg border border-border bg-surface-1 p-3.5">
			<span className="text-xs text-fg-muted">{label}</span>
			<span className="text-2xl font-semibold tabular-nums tracking-tight">{value}</span>
			{sub ? <span className={cn("text-xs", TONE[tone])}>{sub}</span> : null}
		</div>
	)
}

export function FunnelBar({stage, label, count, max}: {stage: DealStage; label: string; count: number; max: number}) {
	const pct = max > 0 ? Math.round((count / max) * 100) : 0
	const color = stage === "WON" ? "bg-success" : stage === "LOST" ? "bg-danger/60" : "bg-accent/85"
	return (
		<div className="grid grid-cols-[88px_1fr_40px] items-center gap-2 text-sm">
			<span className="text-fg-muted">{label}</span>
			<span className="flex h-[18px] items-center">
				<span className={cn("h-full rounded", color)} style={{width: `${pct}%`}} />
			</span>
			<span className="text-right tabular-nums">{count}</span>
		</div>
	)
}

export function MetricStat({label, value}: {label: string; value: string}) {
	return (
		<div className="flex flex-col">
			<span className="text-xs text-fg-muted">{label}</span>
			<span className="text-base font-semibold tabular-nums">{value}</span>
		</div>
	)
}

import Link from "next/link"
import {cn} from "@/lib/cn"
import {ArrowRightIcon} from "@/components/ui/icons"
import {CountUp} from "@/components/ui/count-up"
import {relativeTimePl} from "@/features/metrics/compute"
import type {RecentReply} from "@/features/metrics/queries"

export function MetricStat({label, value}: {label: string; value: string}) {
	return (
		<div className="flex flex-col">
			<span className="text-xs text-fg-muted">{label}</span>
			<span className="text-base font-semibold tabular-nums">{value}</span>
		</div>
	)
}

export function HeroStat({label, value, sub, countUp, index = 0}: {label: string; value: string; sub?: React.ReactNode; countUp?: number; index?: number}) {
	return (
		<div className="flex flex-col px-5 py-4">
			<span className="text-[10px] font-semibold uppercase tracking-[.06em] text-fg-faint">{label}</span>
			<span className="mt-1 text-[26px] font-semibold leading-tight tracking-[-0.03em] tabular-nums">{countUp === undefined ? value : <CountUp value={countUp} delay={0.1 + index * 0.08} />}</span>
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

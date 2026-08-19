import Link from "next/link"
import {requireOrg} from "@/lib/org"
import {getOrgMetrics, getDailySends, getRecentReplies} from "@/features/metrics/queries"
import {formatPct, formatInt} from "@/features/metrics/compute"
import {STAGE_LABEL} from "@/features/pipeline/types"
import {Card} from "@/components/ui/card"
import {Badge} from "@/components/ui/badge"
import {CAMPAIGN_STATUS_LABEL, CAMPAIGN_STATUS_VARIANT} from "@/features/enums/labels"
import type {CampaignStatus} from "@/generated/prisma/client"
import {HeroStat, HealthStat, ReplyRow} from "../dashboard-parts"
import {Sparkline, FunnelRow} from "../dashboard-charts"
import {CountUp} from "@/components/ui/count-up"
import {LiveRefresh} from "./live-refresh"

export default async function DashboardPage() {
	const {orgId} = await requireOrg()
	const now = new Date()
	const [m, daily, replies] = await Promise.all([getOrgMetrics(orgId), getDailySends(orgId, 30, now), getRecentReplies(orgId, 6)])
	const wonCount = m.funnel.find((f) => f.stage === "WON")?.count ?? 0
	const funnelMax = Math.max(1, ...m.funnel.map((f) => f.count))

	if (m.leadsTotal === 0) {
		return (
			<section className="flex flex-col gap-4">
				<h1 className="text-lg font-semibold">Pulpit</h1>
				<p className="text-sm text-fg-muted">Brak danych. Zaimportuj leady i uruchom kampanię, aby zobaczyć metryki.</p>
			</section>
		)
	}

	return (
		<section className="flex flex-col gap-4">
			<LiveRefresh />
			<div className="flex items-baseline justify-between">
				<h1 className="text-lg font-semibold">Pulpit</h1>
				<span className="text-[11px] text-fg-faint">ostatnie 30 dni</span>
			</div>

			<Card className="divide-y divide-border">
				<div className="grid grid-cols-2 divide-x divide-border sm:grid-cols-4">
					<HeroStat label="Leady" value={formatInt(m.leadsTotal)} countUp={m.leadsTotal} index={0} sub={`w ${m.campaignsTotal} kampaniach`} />
					<HeroStat label="Wysłane" value={formatInt(m.mailsSent)} countUp={m.mailsSent} index={1} sub={`do ${formatInt(m.rates.contacted)} leadów`} />
					<HeroStat label="Odpowiedzi" value={formatInt(m.breakdown.replied)} countUp={m.breakdown.replied} index={2} sub={<><span className="font-medium text-success">{m.rates.replyRate === null ? formatPct(null) : <CountUp value={m.rates.replyRate * 100} decimals={1} suffix="%" delay={0.26} />}</span> wskaźnik</>} />
					<HeroStat label="Wygrane" value={formatInt(wonCount)} countUp={wonCount} index={3} sub="lejek: Wygrany" />
				</div>

				<div className="px-5 py-4">
					<div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
						<span className="text-[10px] font-semibold uppercase tracking-[.06em] text-fg-faint">Wysłane maile · dziennie</span>
						{/* Enters LAST, only after the hero count-ups perceptually finish (last stat: .34s start + 1.2s spring) - showing the bounce/unsub percentages earlier would spoil the story the chart is still drawing. */}
						<span className="flex flex-wrap gap-4 [animation:fadeIn_.6s_var(--ease-out)_1.55s_both]">
							<HealthStat color="bg-danger" label="odbicia" value={`${formatInt(m.breakdown.bounced)} · ${formatPct(m.rates.bounceRate)}`} />
							<HealthStat color="bg-warning" label="rezygnacje" value={`${formatInt(m.breakdown.unsubscribed)} · ${formatPct(m.rates.unsubRate)}`} />
							<HealthStat color="bg-fg-faint" label="błędy" value={formatInt(m.breakdown.failed)} />
						</span>
					</div>
					<Sparkline className="h-16 w-full" daily={daily} />
				</div>

				{/* Wave 2 (~.55s): enters while the hero and the wipe settle; wave 3 (~.95s) is the table below. */}
				<div className="grid divide-y divide-border lg:grid-cols-2 lg:divide-x lg:divide-y-0">
					<div className="px-5 py-4 [animation:pageIn_.65s_var(--ease-out)_.55s_both]">
						<div className="mb-2 text-[10px] font-semibold uppercase tracking-[.06em] text-fg-faint">Lejek sprzedaży</div>
						{m.funnel.map((f, i) => (
							<FunnelRow key={f.stage} index={i} delay={0.6} label={STAGE_LABEL[f.stage]} count={f.count} max={funnelMax} tone={f.stage === "WON" ? "won" : f.stage === "LOST" ? "lost" : "neutral"} />
						))}
					</div>
					<div className="px-5 py-4 [animation:pageIn_.65s_var(--ease-out)_.62s_both]">
						<div className="mb-2 text-[10px] font-semibold uppercase tracking-[.06em] text-fg-faint">Ostatnie odpowiedzi</div>
						{replies.length === 0 ? (
							<p className="text-sm text-fg-muted">Brak odpowiedzi.</p>
						) : (
							replies.map((r) => <ReplyRow key={`${r.campaignLeadId}-${r.at.getTime()}`} reply={r} now={now} />)
						)}
					</div>
				</div>

				<div className="px-5 py-4 [animation:pageIn_.65s_var(--ease-out)_.95s_both]">
					<div className="mb-2 text-[10px] font-semibold uppercase tracking-[.06em] text-fg-faint">Kampanie</div>
					{m.campaigns.length === 0 ? (
						<p className="text-sm text-fg-muted">Brak kampanii.</p>
					) : (
						<table className="w-full text-[13px]">
							<thead>
								<tr className="border-b border-border-strong text-left text-[10px] uppercase tracking-[.05em] text-fg-faint">
									<th className="pb-2 pr-3 font-semibold">Kampania</th>
									<th className="pb-2 pr-3 font-semibold">Status</th>
									<th className="pb-2 pr-3 text-right font-semibold">Skontaktowani</th>
									<th className="pb-2 pr-3 font-semibold">Odpowiedzi</th>
									<th className="pb-2 pr-3 text-right font-semibold">Odbicia</th>
									<th className="pb-2 text-right font-semibold">Rezygnacje</th>
								</tr>
							</thead>
							<tbody>
								{m.campaigns.map((c) => (
									<tr className="border-b border-border last:border-b-0" key={c.id}>
										<td className="py-2 pr-3"><Link className="text-fg font-medium hover:underline underline-offset-2" href={`/kampanie/${c.id}`}>{c.name}</Link></td>
										<td className="py-2 pr-3"><Badge variant={CAMPAIGN_STATUS_VARIANT[c.status as CampaignStatus]}>{CAMPAIGN_STATUS_LABEL[c.status as CampaignStatus]}</Badge></td>
										<td className="py-2 pr-3 text-right tabular-nums">{formatInt(c.contacted)}</td>
										<td className="py-2 pr-3">
											<span className="inline-flex items-center gap-2">
												<span className="tabular-nums">{formatInt(c.replied)} <span className="text-fg-muted">· {formatPct(c.replyRate)}</span></span>
												<span className="relative h-[3px] w-[52px] overflow-hidden rounded-full bg-surface-3">
													<span className="absolute inset-y-0 left-0 rounded-full bg-fg" style={{width: `${Math.min(100, Math.round((c.replyRate ?? 0) * 1000))}%`}} />
												</span>
											</span>
										</td>
										<td className="py-2 pr-3 text-right tabular-nums">{formatInt(c.bounced)}</td>
										<td className="py-2 text-right tabular-nums">{formatInt(c.unsubscribed)}</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
				</div>
			</Card>

			<p className="text-xs text-fg-faint">Bez śledzenia otwarć i kliknięć (open-pixel wyłączony). Wskaźniki liczone względem leadów, do których wyszła min. 1 wiadomość.</p>
		</section>
	)
}

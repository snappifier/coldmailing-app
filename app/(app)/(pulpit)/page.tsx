import {cookies} from "next/headers"
import {requireOrg} from "@/lib/org"
import {getOrgMetrics, getDailySends, getRecentReplies} from "@/features/metrics/queries"
import {formatPct, formatInt} from "@/features/metrics/compute"
import {STAGE_LABEL} from "@/features/pipeline/types"
import type {CampaignStatus} from "@/generated/prisma/client"
import {HeroStat, HealthStat, ReplyRow} from "../dashboard-parts"
import {Sparkline, FunnelRow} from "../dashboard-charts"
import {CountUp} from "@/components/ui/count-up"
import {LiveRefresh} from "./live-refresh"
import {MorphCard, MorphSection, CollapsibleSection, CampaignsTable} from "./dashboard-morph"

export default async function DashboardPage() {
	const {orgId} = await requireOrg()
	const now = new Date()
	// The pulpit keeps ONE glanceable 30-day chart (consistent with the "ostatnie 30 dni" header);
	// deeper ranges/metrics live on /analytics.
	const [m, daily, replies] = await Promise.all([getOrgMetrics(orgId), getDailySends(orgId, 30, now), getRecentReplies(orgId, 6)])
	// SSR the persisted collapse state so hydration never re-closes a section (visible jump on F5).
	let collapsedMap: Record<string, boolean> = {}
	try { collapsedMap = JSON.parse(decodeURIComponent((await cookies()).get("pulpit-collapsed")?.value ?? "%7B%7D")) as Record<string, boolean> } catch { collapsedMap = {} }
	if (!collapsedMap || typeof collapsedMap !== "object") collapsedMap = {}
	const wonCount = m.funnel.find((f) => f.stage === "WON")?.count ?? 0
	const funnelMax = Math.max(1, ...m.funnel.map((f) => f.count))
	const campaignRows = m.campaigns.map((c) => ({
		id: c.id,
		name: c.name,
		status: c.status as CampaignStatus,
		contacted: formatInt(c.contacted),
		replied: formatInt(c.replied),
		replyPct: formatPct(c.replyRate),
		barPct: Math.min(100, Math.round((c.replyRate ?? 0) * 1000)),
		bounced: formatInt(c.bounced),
		unsubscribed: formatInt(c.unsubscribed),
	}))

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

			<MorphCard>
				<MorphSection>
					<div className="grid grid-cols-2 divide-x divide-border sm:grid-cols-4">
						<HeroStat label="Leady" value={formatInt(m.leadsTotal)} countUp={m.leadsTotal} index={0} sub={`w ${m.campaignsTotal} kampaniach`} />
						<HeroStat label="Wysłane" value={formatInt(m.mailsSent)} countUp={m.mailsSent} index={1} sub={`do ${formatInt(m.rates.contacted)} leadów`} />
						<HeroStat label="Odpowiedzi" value={formatInt(m.breakdown.replied)} countUp={m.breakdown.replied} index={2} sub={<><span className="font-medium text-success">{m.rates.replyRate === null ? formatPct(null) : <CountUp value={m.rates.replyRate * 100} decimals={1} suffix="%" delay={0.71} />}</span> wskaźnik</>} />
						<HeroStat label="Wygrane" value={formatInt(wonCount)} countUp={wonCount} index={3} sub="lejek: Wygrany" />
					</div>
				</MorphSection>

				<MorphSection>
					<div className="px-5 py-4">
						<div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
							<span className="text-[10px] font-semibold uppercase tracking-[.06em] text-fg-faint">Wysłane maile · dziennie</span>
							{/* Enters LAST, only after the hero count-ups perceptually finish (last stat: .79s start + 1.2s spring) - showing the bounce/unsub percentages earlier would spoil the story the chart is still drawing. */}
							<span className="flex flex-wrap gap-4 [animation:fadeIn_.6s_var(--ease-out)_2s_both]">
								<HealthStat color="bg-danger" label="odbicia" value={`${formatInt(m.breakdown.bounced)} · ${formatPct(m.rates.bounceRate)}`} />
								<HealthStat color="bg-warning" label="rezygnacje" value={`${formatInt(m.breakdown.unsubscribed)} · ${formatPct(m.rates.unsubRate)}`} />
								<HealthStat color="bg-fg-faint" label="błędy" value={formatInt(m.breakdown.failed)} />
							</span>
						</div>
						<Sparkline className="h-16 w-full" daily={daily} />
					</div>
				</MorphSection>

				{/* Two-beat entry: lejek/odpowiedzi/kampanie fade in TOGETHER (.1s), then the data paints
				    together (count-ups .55+, funnel bars .55+, wipe .55). */}
				<MorphSection>
					<div className="grid divide-y divide-border lg:grid-cols-2 lg:divide-x lg:divide-y-0">
						<div className="px-5 py-4 [animation:pageIn_.65s_var(--ease-out)_.1s_both]">
							<CollapsibleSection id="lejek" label="Lejek sprzedaży" defaultCollapsed={collapsedMap.lejek === true}>
								{m.funnel.map((f, i) => (
									<FunnelRow key={f.stage} index={i} delay={0.55} label={STAGE_LABEL[f.stage]} count={f.count} max={funnelMax} tone={f.stage === "WON" ? "won" : f.stage === "LOST" ? "lost" : "neutral"} />
								))}
							</CollapsibleSection>
						</div>
						<div className="px-5 py-4 [animation:pageIn_.65s_var(--ease-out)_.1s_both]">
							<CollapsibleSection id="odpowiedzi" label="Ostatnie odpowiedzi" defaultCollapsed={collapsedMap.odpowiedzi === true}>
								{replies.length === 0 ? (
									<p className="text-sm text-fg-muted">Brak odpowiedzi.</p>
								) : (
									replies.map((r) => <ReplyRow key={`${r.campaignLeadId}-${r.at.getTime()}`} reply={r} now={now} />)
								)}
							</CollapsibleSection>
						</div>
					</div>
				</MorphSection>

				<MorphSection>
					<div className="px-5 py-4 [animation:pageIn_.65s_var(--ease-out)_.1s_both]">
						<CollapsibleSection id="kampanie" label="Kampanie" defaultCollapsed={collapsedMap.kampanie === true}>
							{campaignRows.length === 0 ? <p className="text-sm text-fg-muted">Brak kampanii.</p> : <CampaignsTable rows={campaignRows} />}
						</CollapsibleSection>
					</div>
				</MorphSection>
			</MorphCard>

			<p className="text-xs text-fg-faint">Bez śledzenia otwarć i kliknięć (open-pixel wyłączony). Wskaźniki liczone względem leadów, do których wyszła min. 1 wiadomość.</p>
		</section>
	)
}

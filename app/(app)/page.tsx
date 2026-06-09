// app/(app)/page.tsx
import Link from "next/link"
import {requireOrg} from "@/lib/org"
import {getOrgMetrics} from "@/features/metrics/queries"
import {formatPct, formatInt} from "@/features/metrics/compute"
import {STAGE_LABEL} from "@/features/pipeline/types"
import {Kpi, FunnelBar} from "./dashboard-parts"

export default async function DashboardPage() {
	const {orgId} = await requireOrg()
	const m = await getOrgMetrics(orgId)
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
		<section className="flex flex-col gap-6">
			<h1 className="text-lg font-semibold">Pulpit</h1>

			<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
				<Kpi label="Leady" value={formatInt(m.leadsTotal)} sub={`w ${m.campaignsTotal} kampaniach`} />
				<Kpi label="Wysłane maile" value={formatInt(m.mailsSent)} sub={`do ${formatInt(m.rates.contacted)} leadów`} />
				<Kpi label="Odpowiedzi" value={formatInt(m.breakdown.replied)} sub={`${formatPct(m.rates.replyRate)} wskaźnik`} tone="up" />
				<Kpi label="Wygrane" value={formatInt(wonCount)} sub="lejek: WON" tone="up" />
				<Kpi label="Odbicia" value={formatInt(m.breakdown.bounced)} sub={formatPct(m.rates.bounceRate)} tone="warn" />
				<Kpi label="Rezygnacje" value={formatInt(m.breakdown.unsubscribed)} sub={formatPct(m.rates.unsubRate)} tone="warn" />
				<Kpi label="Błędy wysyłki" value={formatInt(m.breakdown.failed)} sub="FAILED" tone="bad" />
				<Kpi label="Aktywne kampanie" value={formatInt(m.campaignsActive)} sub={`z ${m.campaignsTotal}`} />
			</div>

			<div className="grid gap-4 lg:grid-cols-2">
				<div className="rounded-lg border border-border bg-surface-1 p-4">
					<h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-fg-faint">Lejek sprzedaży</h2>
					<div className="flex flex-col gap-2">
						{m.funnel.map((f) => (
							<FunnelBar key={f.stage} stage={f.stage} label={STAGE_LABEL[f.stage]} count={f.count} max={funnelMax} />
						))}
					</div>
				</div>

				<div className="rounded-lg border border-border bg-surface-1 p-4">
					<h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-fg-faint">Kampanie</h2>
					{m.campaigns.length === 0 ? (
						<p className="text-sm text-fg-muted">Brak kampanii.</p>
					) : (
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-border-strong text-left text-xs uppercase tracking-wide text-fg-faint">
									<th className="pb-2 pr-2 font-semibold">Kampania</th>
									<th className="pb-2 pr-2 font-semibold">Skontakt.</th>
									<th className="pb-2 pr-2 font-semibold">Odpowiedzi</th>
									<th className="pb-2 pr-2 font-semibold">Odb.</th>
									<th className="pb-2 font-semibold">Rez.</th>
								</tr>
							</thead>
							<tbody>
								{m.campaigns.map((c) => (
									<tr className="border-b border-border" key={c.id}>
										<td className="py-1.5 pr-2">
											<Link className="text-accent hover:underline" href={`/kampanie/${c.id}`}>{c.name}</Link>
											<span className="ml-1 text-fg-faint">· {c.status}</span>
										</td>
										<td className="py-1.5 pr-2 tabular-nums">{formatInt(c.contacted)}</td>
										<td className="py-1.5 pr-2 tabular-nums">{formatInt(c.replied)} <span className="text-fg-muted">{formatPct(c.replyRate)}</span></td>
										<td className="py-1.5 pr-2 tabular-nums">{formatInt(c.bounced)}</td>
										<td className="py-1.5 tabular-nums">{formatInt(c.unsubscribed)}</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
				</div>
			</div>

			<p className="text-xs text-fg-faint">Bez śledzenia otwarć i kliknięć (open-pixel wyłączony). Wskaźniki liczone względem leadów, do których wyszła min. 1 wiadomość.</p>
		</section>
	)
}

"use client"
import {useState, useSyncExternalStore} from "react"
import Link from "next/link"
import {AnimatePresence, LayoutGroup, motion, useReducedMotion} from "motion/react"
import {EASE_OUT_QUART, SPRING_SETTLE} from "@/lib/motion"
import {cn} from "@/lib/cn"
import {Badge} from "@/components/ui/badge"
import {ChevronDownIcon} from "@/components/ui/icons"
import {CAMPAIGN_STATUS_LABEL, CAMPAIGN_STATUS_VARIANT} from "@/features/enums/labels"
import type {CampaignStatus} from "@/generated/prisma/client"

// Collapse store: one COOKIE holding a JSON object keyed by section id (not localStorage - the
// page reads the cookie server-side and SSRs a persisted-collapsed section CLOSED, so a hard
// reload never renders it open and then animates it shut after hydration). useSyncExternalStore
// keeps toggles reactive with no setState-in-effect; the client snapshot reads the same cookie
// the server saw, so hydration matches by construction. Snapshots are primitive booleans.
const PULPIT_KEY = "pulpit-collapsed"
let listeners: (() => void)[] = []
let cache: Record<string, boolean> | null = null
function subscribeCollapse(cb: () => void) {
	listeners = [...listeners, cb]
	return () => { listeners = listeners.filter((l) => l !== cb) }
}
function readAll(): Record<string, boolean> {
	if (cache) return cache
	try {
		const raw = document.cookie.split("; ").find((c) => c.startsWith(`${PULPIT_KEY}=`))
		cache = raw ? JSON.parse(decodeURIComponent(raw.slice(PULPIT_KEY.length + 1))) as Record<string, boolean> : {}
	} catch { cache = {} }
	if (!cache || typeof cache !== "object") cache = {}
	return cache
}
function setCollapsed(id: string, v: boolean) {
	cache = {...readAll(), [id]: v}
	try { document.cookie = `${PULPIT_KEY}=${encodeURIComponent(JSON.stringify(cache))}; path=/; max-age=31536000; samesite=lax` } catch { /* ignore */ }
	for (const l of listeners) l()
}

// Technique A - Motion layout FLIP - with the full anti-warp correction set (spec + the a8356fa
// revert lesson): borderRadius via style (Motion scale-corrects it only there), the card's 1px
// border replaced by a padding-as-border wrapper (a real border cannot render below 1px mid-scale
// and shimmers), sections counter-corrected via layout="position" so hairlines and content never
// scale. LayoutGroup makes collapse/expand state changes INSIDE a section re-measure the card -
// without it a child-only re-render would never trigger the card's FLIP.
// Fallback clause (spec): if live smoke still warps, swap these internals to a measured-height
// animation - the page contract (children as sections) stays identical.
export function MorphCard({children}: {children: React.ReactNode}) {
	const reduce = useReducedMotion()
	const t = reduce ? {duration: 0} : SPRING_SETTLE
	return (
		<LayoutGroup>
			<motion.div className="bg-border p-px shadow-card" layout={!reduce} style={{borderRadius: 8}} transition={t}>
				<motion.div className="divide-y divide-border overflow-hidden bg-surface-1" layout={!reduce} style={{borderRadius: 7}} transition={t}>
					{children}
				</motion.div>
			</motion.div>
		</LayoutGroup>
	)
}

// Section wrapper counter-corrected against the card's FLIP scale (layout="position") so
// hairlines and content never warp during event morphs. Page entry stays the pageIn waves -
// the morph fires only on events (live refresh, collapse/expand, table toggle).
export function MorphSection({className, children}: {className?: string; children: React.ReactNode}) {
	const reduce = useReducedMotion()
	return (
		<motion.div className={className} layout={reduce ? false : "position"} transition={reduce ? {duration: 0} : SPRING_SETTLE}>
			{children}
		</motion.div>
	)
}

// Clickable uppercase header + fade-out/in content. Sequence on collapse: content fades 130ms,
// AnimatePresence removes it, the removal render triggers the card FLIP shut (LayoutGroup). The
// root is itself a layout="position" motion.div, since Motion only dirties a LayoutGroup when a
// component carrying `layout` re-renders (willUpdate fires from getSnapshotBeforeUpdate) - a plain
// div here would re-render without ever notifying the card, so both expand and collapse need it.
export function CollapsibleSection({id, label, defaultCollapsed = false, children}: {id: string; label: string; defaultCollapsed?: boolean; children: React.ReactNode}) {
	const reduce = useReducedMotion()
	const collapsed = useSyncExternalStore(subscribeCollapse, () => readAll()[id] === true, () => defaultCollapsed)
	return (
		<motion.div layout={reduce ? false : "position"} transition={reduce ? {duration: 0} : SPRING_SETTLE}>
			<button
				className="group mb-2 flex w-full items-center justify-between gap-2 text-left"
				type="button"
				aria-expanded={!collapsed}
				onClick={() => setCollapsed(id, !collapsed)}
			>
				<span className="text-[10px] font-semibold uppercase tracking-[.06em] text-fg-faint transition-colors group-hover:text-fg-muted">{label}</span>
				<ChevronDownIcon className={cn("size-3.5 text-fg-faint transition-transform duration-200 ease-out", collapsed && "-rotate-90")} />
			</button>
			{/* initial={false} is LOAD-BEARING: without it the content div SSRs with inline opacity:0
			    and every hard reload paints the sections EMPTY until hydration pops the content in -
			    the whole pulpit visibly jumped on F5. The funnel bars' entrance is CSS (.funnel-grow),
			    so this suppression does not affect it. */}
			<AnimatePresence initial={false}>
				{!collapsed ? (
					<motion.div
						initial={reduce ? false : {opacity: 0}}
						animate={{opacity: 1}}
						exit={{opacity: 0}}
						transition={{duration: reduce ? 0 : 0.13, ease: EASE_OUT_QUART}}
					>
						{children}
					</motion.div>
				) : null}
			</AnimatePresence>
		</motion.div>
	)
}

export interface CampaignRowData {
	id: string
	name: string
	status: CampaignStatus
	contacted: string
	replied: string
	replyPct: string
	barPct: number
	bounced: string
	unsubscribed: string
}

const TABLE_LIMIT = 5

// The campaigns table, moved from the page so the 5-row limit can be client state; expanding
// rides the same LayoutGroup FLIP as everything else - the motion.div wrapper (layout="position")
// is what makes that true, since a plain fragment carries no `layout` prop to dirty the group.
// Markup is byte-equal to the old server table.
export function CampaignsTable({rows}: {rows: CampaignRowData[]}) {
	const reduce = useReducedMotion()
	const [expanded, setExpanded] = useState(false)
	const shown = expanded ? rows : rows.slice(0, TABLE_LIMIT)
	return (
		<motion.div layout={reduce ? false : "position"} transition={reduce ? {duration: 0} : SPRING_SETTLE}>
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
					{shown.map((c) => (
						<tr className="border-b border-border last:border-b-0" key={c.id}>
							<td className="py-2 pr-3"><Link className="text-fg font-medium hover:underline underline-offset-2" href={`/kampanie/${c.id}`}>{c.name}</Link></td>
							<td className="py-2 pr-3"><Badge variant={CAMPAIGN_STATUS_VARIANT[c.status]}>{CAMPAIGN_STATUS_LABEL[c.status]}</Badge></td>
							<td className="py-2 pr-3 text-right tabular-nums">{c.contacted}</td>
							<td className="py-2 pr-3">
								<span className="inline-flex items-center gap-2">
									<span className="tabular-nums">{c.replied} <span className="text-fg-muted">· {c.replyPct}</span></span>
									<span className="relative h-[3px] w-[52px] overflow-hidden rounded-full bg-surface-3">
										<span className="absolute inset-y-0 left-0 rounded-full bg-fg" style={{width: `${c.barPct}%`}} />
									</span>
								</span>
							</td>
							<td className="py-2 pr-3 text-right tabular-nums">{c.bounced}</td>
							<td className="py-2 text-right tabular-nums">{c.unsubscribed}</td>
						</tr>
					))}
				</tbody>
			</table>
			{rows.length > TABLE_LIMIT ? (
				<button className="mt-2 text-[12px] text-fg-muted transition-colors hover:text-fg hover:underline underline-offset-2" type="button" aria-expanded={expanded} onClick={() => setExpanded((e) => !e)}>
					{expanded ? "Zwiń" : `Pokaż wszystkie (${rows.length})`}
				</button>
			) : null}
		</motion.div>
	)
}

"use client"
// app/(app)/kampanie/[id]/campaign-tabs.tsx

import {useState} from "react"
import {AnimatePresence, motion, useReducedMotion} from "motion/react"
import {EASE_OUT_QUART, SPRING_SETTLE} from "@/lib/motion"
import {cn} from "@/lib/cn"

const TABS = [
	{id: "sekwencja", label: "Sekwencja"},
	{id: "leady", label: "Leady i wysyłka"},
	{id: "przychodzace", label: "Przychodzące"},
] as const
type TabId = (typeof TABS)[number]["id"]

export function CampaignTabs({sekwencja, leady, przychodzace, inboundCount}: {sekwencja: React.ReactNode; leady: React.ReactNode; przychodzace: React.ReactNode; inboundCount: number}) {
	const [active, setActive] = useState<TabId>("sekwencja")
	const reduce = useReducedMotion()
	const content: Record<TabId, React.ReactNode> = {sekwencja, leady, przychodzace}

	return (
		<div>
			<div className="flex gap-1 border-b border-border" role="tablist">
				{TABS.map((t) => (
					<button
						className={cn(
							"relative px-3 py-2 text-sm transition-colors",
							t.id === active ? "text-fg" : "text-fg-muted hover:text-fg",
						)}
						key={t.id}
						type="button"
						role="tab"
						aria-selected={t.id === active}
						onClick={() => setActive(t.id)}
					>
						{t.label}
						{t.id === "przychodzace" && inboundCount > 0 ? <span className="ml-1.5 text-[11px] text-fg-faint">{inboundCount}</span> : null}
						{t.id === active ? (
							reduce ? (
								<span className="absolute inset-x-0 -bottom-px h-0.5 bg-accent" />
							) : (
								<motion.span layoutId="campaign-tab" className="absolute inset-x-0 -bottom-px h-0.5 bg-accent" transition={SPRING_SETTLE} />
							)
						) : null}
					</button>
				))}
			</div>
			<div className="pt-4">
				<AnimatePresence mode="wait">
					<motion.div
						key={active}
						initial={reduce ? false : {opacity: 0, y: 8}}
						animate={{opacity: 1, y: 0}}
						exit={reduce ? {opacity: 0} : {opacity: 0, y: -4}}
						transition={{duration: 0.24, ease: EASE_OUT_QUART}}
					>
						{content[active]}
					</motion.div>
				</AnimatePresence>
			</div>
		</div>
	)
}

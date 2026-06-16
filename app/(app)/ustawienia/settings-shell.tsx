"use client"
// app/(app)/ustawienia/settings-shell.tsx
import {useState} from "react"
import {AnimatePresence, motion, useReducedMotion} from "motion/react"
import {EASE_OUT_QUART, SPRING_SETTLE} from "@/lib/motion"
import {cn} from "@/lib/cn"
import {Card, CardBody} from "@/components/ui/card"

export interface SettingsSection {
	id: string
	label: string
	content: React.ReactNode
}

export function SettingsShell({sections}: {sections: SettingsSection[]}) {
	const [active, setActive] = useState(sections[0]?.id)
	const reduce = useReducedMotion()
	const current = sections.find((s) => s.id === active) ?? sections[0]
	return (
		<div className="grid grid-cols-[200px_1fr] gap-10 max-md:grid-cols-1">
			<nav className="flex flex-col gap-px max-md:flex-row max-md:flex-wrap">
				{sections.map((s) => (
					<button
						key={s.id}
						type="button"
						aria-current={s.id === active ? "true" : undefined}
						onClick={() => setActive(s.id)}
						className={cn(
							"relative rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors duration-150",
							s.id === active ? "bg-surface-2 text-fg" : "text-fg-muted hover:bg-surface-1 hover:text-fg",
						)}
					>
						{s.id === active ? (
							reduce ? (
								<span className="absolute -left-px top-1/2 h-[15px] w-[2.5px] -translate-y-1/2 rounded bg-accent" />
							) : (
								<motion.span layoutId="settings-rail" className="absolute -left-px top-1/2 h-[15px] w-[2.5px] -translate-y-1/2 rounded bg-accent" transition={SPRING_SETTLE} />
							)
						) : null}
						{s.label}
					</button>
				))}
			</nav>
			<motion.div className="min-h-[300px]" layout={reduce ? false : "size"} transition={SPRING_SETTLE}>
				<AnimatePresence mode="wait" initial={false}>
					<motion.div
						key={current?.id}
						layout={reduce ? false : "position"}
						initial={reduce ? false : {opacity: 0}}
						animate={{opacity: 1}}
						exit={{opacity: 0}}
						transition={{duration: reduce ? 0 : 0.13, ease: EASE_OUT_QUART}}
					>
						<h2 className="text-[15px] font-semibold tracking-[-0.02em]">{current?.label}</h2>
						<Card className="mt-4"><CardBody>{current?.content}</CardBody></Card>
					</motion.div>
				</AnimatePresence>
			</motion.div>
		</div>
	)
}

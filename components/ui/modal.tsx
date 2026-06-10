"use client"
// components/ui/modal.tsx
import {useEffect, useRef} from "react"
import {AnimatePresence, motion, useReducedMotion} from "motion/react"

const EASE_OUT_QUART: [number, number, number, number] = [0.165, 0.84, 0.44, 1]

// Native <dialog> shell (ESC + focus handled by the platform); the visual panel is a Motion child
// implementing the binding animation spec (enter 200ms ease-out-quart from scale .96, exit 160ms,
// layout morph spring visualDuration .25 bounce 0). Reduced motion snaps everything.
export function Modal({open, onClose, title, children, footer, width = 420}: {open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; width?: number}) {
	const ref = useRef<HTMLDialogElement>(null)
	// Latest open value for onExitComplete: a rapid close->reopen must not let the stale
	// exit callback close the freshly reopened dialog.
	const openRef = useRef(open)
	const reduce = useReducedMotion()

	useEffect(() => {
		openRef.current = open
		const dialog = ref.current
		if (!dialog) return
		if (open && !dialog.open) dialog.showModal()
		if (!open && dialog.open && reduce) dialog.close()
	}, [open, reduce])

	return (
		<dialog
			className="m-auto bg-transparent p-0 backdrop:bg-black/50 backdrop:backdrop-blur-[2px]"
			ref={ref}
			style={{width, maxWidth: "calc(100vw - 32px)"}}
			onCancel={(e) => {
				e.preventDefault()
				onClose()
			}}
			onClick={(e) => {
				if (e.target === ref.current) onClose()
			}}
		>
			<AnimatePresence onExitComplete={() => {if (!openRef.current) ref.current?.close()}}>
				{open ? (
					<motion.div
						className="overflow-hidden rounded-lg border border-border-strong bg-surface-1 text-fg shadow-[0_24px_64px_-24px_rgba(0,0,0,.8)]"
						layout={!reduce}
						initial={reduce ? false : {opacity: 0, scale: 0.96, y: 8}}
						animate={{opacity: 1, scale: 1, y: 0}}
						exit={reduce ? {opacity: 0, transition: {duration: 0}} : {opacity: 0, scale: 0.97, transition: {duration: 0.16, ease: EASE_OUT_QUART}}}
						transition={{duration: 0.2, ease: EASE_OUT_QUART, layout: reduce ? {duration: 0} : {type: "spring", visualDuration: 0.25, bounce: 0}}}
					>
						<motion.div layout="position">
							<div className="px-[18px] pt-4">
								<h3 className="text-[15px] font-semibold tracking-[-0.02em]">{title}</h3>
							</div>
							<div className="px-[18px] py-4">{children}</div>
							{footer ? <div className="flex items-center justify-between gap-3 border-t border-border bg-surface-2/60 px-[18px] py-3">{footer}</div> : null}
						</motion.div>
					</motion.div>
				) : null}
			</AnimatePresence>
		</dialog>
	)
}

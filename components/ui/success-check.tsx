"use client"
import {motion, useReducedMotion} from "motion/react"
import {EASE_OUT_QUART, SPRING_SETTLE} from "@/lib/motion"

// Green success check: path draws in, wrapper settles with bounce:0 (no overshoot).
export function SuccessCheck({className}: {className?: string}) {
	const reduce = useReducedMotion()
	return (
		<motion.span className={className} style={{display: "inline-flex"}} initial={reduce ? false : {scale: 0.9}} animate={{scale: 1}} transition={SPRING_SETTLE}>
			<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
				<motion.path d="M20 6L9 17l-5-5" initial={reduce ? false : {pathLength: 0}} animate={{pathLength: 1}} transition={{duration: 0.28, ease: EASE_OUT_QUART}} />
			</svg>
		</motion.span>
	)
}

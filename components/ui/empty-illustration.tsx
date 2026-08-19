"use client"
import {motion, useReducedMotion} from "motion/react"
import {EASE_OUT_QUART} from "@/lib/motion"

// Line-only inbox glyph, draws in once. Neutral stroke (text-fg-faint), 1.8px icon vocabulary.
export function EmptyIllustration() {
	const reduce = useReducedMotion()
	return (
		<svg className="mx-auto mb-3 text-fg-faint" width="44" height="44" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
			<motion.path d="M8 18 L18 18 L21 24 L27 24 L30 18 L40 18 L40 38 L8 38 Z M12 12 L36 12" initial={reduce ? false : {pathLength: 0}} animate={{pathLength: 1}} transition={{duration: 1.0, ease: EASE_OUT_QUART}} />
		</svg>
	)
}

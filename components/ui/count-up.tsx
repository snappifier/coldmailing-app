"use client"
import {useEffect, useState} from "react"
import {useReducedMotion} from "motion/react"
import {AnimateNumber} from "motion-plus/react"
import {cn} from "@/lib/cn"
import {SPRING_REVEAL, SPRING_SETTLE} from "@/lib/motion"

// Odometer count-up on Motion+'s AnimateNumber. Until the entrance starts the number is INVISIBLE
// (display === null renders a transparent 0), then it fades in over 200ms while the digits roll
// 0 -> value on the same bounce:0 spring as the sparkline wipe (SPRING_REVEAL drives the y roll;
// layout/opacity handle digit enter/exit on the quick settle spring) - so a page load never shows
// a row of static zeros. `delay` staggers the four stats; once entered, later value changes
// (recalc after refresh) roll immediately with no delay and no hide. Reduced motion mounts
// directly at the target. pl-PL locale grouping keeps the thousands separator consistent with
// formatInt used elsewhere.
export function CountUp({value, delay = 0}: {value: number; delay?: number}) {
	const reduce = useReducedMotion()
	const [display, setDisplay] = useState<number | null>(reduce ? value : null)
	useEffect(() => {
		const t = setTimeout(() => setDisplay(value), reduce || display !== null ? 0 : delay * 1000)
		return () => clearTimeout(t)
	}, [value, reduce, delay, display])
	return (
		<span className={cn("inline-block transition-opacity duration-200 ease-out", display === null && "opacity-0")}>
			<AnimateNumber locales="pl-PL" format={{useGrouping: true}} transition={{y: SPRING_REVEAL, layout: SPRING_SETTLE, opacity: {duration: 0.25}}}>
				{display ?? 0}
			</AnimateNumber>
		</span>
	)
}

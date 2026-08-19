"use client"
import {useEffect, useRef, useState} from "react"
import {useReducedMotion} from "motion/react"
import {AnimateNumber} from "motion-plus/react"
import {cn} from "@/lib/cn"
import {SPRING_REVEAL, SPRING_SETTLE} from "@/lib/motion"

// Odometer count-up on Motion+'s AnimateNumber. Until the entrance starts the number is INVISIBLE
// (display === null renders a transparent 0), then it fades in over 200ms while the digits roll
// 0 -> value on the same bounce:0 spring as the sparkline wipe (SPRING_REVEAL drives the y roll;
// layout/opacity handle digit enter/exit on the quick settle spring) - so a page load never shows
// a row of static zeros. `delay` staggers the four stats. Once entered, later value changes (the
// pulpit live-refreshes every 30s) roll immediately AND flash the trend for 1.2s - success on a
// rise, danger on a drop (status colors only, per the taste contract; the entrance itself never
// flashes). Reduced motion mounts directly at the target. pl-PL locale formatting (grouping,
// decimal comma) keeps the output consistent with formatInt/formatPct used elsewhere.
export function CountUp({value, delay = 0, decimals = 0, suffix}: {value: number; delay?: number; decimals?: number; suffix?: string}) {
	const reduce = useReducedMotion()
	const [display, setDisplay] = useState<number | null>(reduce ? value : null)
	const [trend, setTrend] = useState<0 | 1 | -1>(0)
	const last = useRef<number | null>(null)
	useEffect(() => {
		const t = setTimeout(() => {
			if (last.current !== null && last.current !== value) setTrend(value > last.current ? 1 : -1)
			last.current = value
			setDisplay(value)
		}, reduce || last.current !== null ? 0 : delay * 1000)
		return () => clearTimeout(t)
	}, [value, reduce, delay])
	useEffect(() => {
		if (trend === 0) return
		const t = setTimeout(() => setTrend(0), 1200)
		return () => clearTimeout(t)
	}, [trend])
	return (
		<span className={cn("inline-block transition-[opacity,color] duration-300 ease-out", display === null && "opacity-0", trend === 1 && "text-success", trend === -1 && "text-danger")}>
			<AnimateNumber
				locales="pl-PL"
				format={{useGrouping: true, minimumFractionDigits: decimals, maximumFractionDigits: decimals}}
				suffix={suffix}
				transition={{y: SPRING_REVEAL, layout: SPRING_SETTLE, opacity: {duration: 0.25}}}
			>
				{display ?? 0}
			</AnimateNumber>
		</span>
	)
}

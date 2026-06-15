"use client"
// components/ui/count-up.tsx
import {useEffect, useRef} from "react"
import {animate, motion, useMotionValue, useReducedMotion, useTransform} from "motion/react"
import {EASE_OUT_QUART} from "@/lib/motion"
import {formatInt} from "@/features/metrics/compute"

// Counts 0 -> value once on first mount; snaps on later value changes and under reduced motion.
// formatInt (pure NBSP-thousands) is imported, not passed as a prop, because functions are not
// serializable across the server/client boundary. The MotionValue is read only inside useTransform
// (function syntax - the mapping overload useTransform(mv, fn) is deprecated).
export function CountUp({value}: {value: number}) {
	const reduce = useReducedMotion()
	const mv = useMotionValue(reduce ? value : 0)
	const text = useTransform(() => formatInt(Math.round(mv.get())))
	const done = useRef(false)
	useEffect(() => {
		if (reduce || done.current) {
			mv.set(value)
			done.current = true
			return
		}
		done.current = true
		const controls = animate(mv, value, {duration: 0.5, ease: EASE_OUT_QUART})
		return () => controls.stop()
	}, [value, reduce, mv])
	return <motion.span>{text}</motion.span>
}

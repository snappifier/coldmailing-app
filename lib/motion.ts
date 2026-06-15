// lib/motion.ts
// Canonical motion tokens (see docs/superpowers/design-references.md): the ONLY easing curve
// and spring in the app. Do not introduce per-component bespoke curves - reuse these.
export const EASE_OUT_QUART: [number, number, number, number] = [0.165, 0.84, 0.44, 1]
export const SPRING_SETTLE = {type: "spring", visualDuration: 0.25, bounce: 0} as const

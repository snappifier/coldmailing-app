// Canonical motion tokens (see docs/superpowers/design-references.md): the ONLY easing curve
// and spring in the app. Do not introduce per-component bespoke curves - reuse these.
export const EASE_OUT_QUART: [number, number, number, number] = [0.165, 0.84, 0.44, 1]
export const SPRING_SETTLE = {type: "spring", visualDuration: 0.25, bounce: 0} as const
// Dashboard entrance spring (chart wipe + hero count-up): bounce 0, perceptual 1.2s (~1.9s with
// settle). The SAME curve lives in the --spring-linear custom property in globals.css, consumed
// by .spark-wipe - change both together.
export const SPRING_REVEAL = {type: "spring", visualDuration: 1.2, bounce: 0} as const

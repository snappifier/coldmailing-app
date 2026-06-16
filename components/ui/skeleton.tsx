// components/ui/skeleton.tsx
import {cn} from "@/lib/cn"

// Pulsing placeholder block for loading states. CSS animation (animate-pulse) so it runs reliably;
// the global prefers-reduced-motion reset neutralises the pulse.
export function Skeleton({className}: {className?: string}) {
	return <div className={cn("animate-pulse rounded-md bg-surface-3", className)} />
}

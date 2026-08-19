import {cn} from "@/lib/cn"
export function Card({className, children}: {className?: string; children: React.ReactNode}) {
	return <div className={cn("rounded-lg border border-border bg-surface-1 shadow-card", className)}>{children}</div>
}
export function CardBody({className, children}: {className?: string; children: React.ReactNode}) {
	return <div className={cn("p-4.5", className)}>{children}</div>
}
export function CardFooter({className, children}: {className?: string; children: React.ReactNode}) {
	return <div className={cn("flex items-center justify-between gap-3 rounded-b-lg border-t border-border bg-surface-2/60 px-4.5 py-3 text-[12.5px] text-fg-muted", className)}>{children}</div>
}

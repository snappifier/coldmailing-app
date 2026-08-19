import {cn} from "@/lib/cn"
export function Table({className, children}: {className?: string; children: React.ReactNode}) {
	return <table className={cn("w-full border-collapse text-[13px] [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-surface-2/50", className)}>{children}</table>
}
export function Th({className, children}: {className?: string; children: React.ReactNode}) {
	return <th className={cn("border-b border-border px-3.5 pb-2.5 text-left text-[11.5px] font-medium uppercase tracking-wide text-fg-faint", className)}>{children}</th>
}
export function Td({className, children}: {className?: string; children: React.ReactNode}) {
	return <td className={cn("border-b border-border px-3.5 py-3", className)}>{children}</td>
}

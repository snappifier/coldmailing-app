// components/ui/page-header.tsx
export function PageHeader({title, description, meta, action}: {title: string; description?: string; meta?: React.ReactNode; action?: React.ReactNode}) {
	return (
		<div className="flex items-start justify-between gap-4 border-b border-border pb-4">
			<div className="min-w-0">
				<h1 className="text-[17px] font-semibold tracking-[-0.02em]">{title}</h1>
				{description ? <p className="mt-0.5 text-[12.5px] text-fg-muted">{description}</p> : null}
				{meta ? <p className="mt-1.5 text-[11px] tabular-nums text-fg-faint">{meta}</p> : null}
			</div>
			{action ? <div className="flex flex-none items-center gap-2">{action}</div> : null}
		</div>
	)
}

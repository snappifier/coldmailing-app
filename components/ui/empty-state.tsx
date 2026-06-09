// components/ui/empty-state.tsx
export function EmptyState({title, description, action}: {title: string; description?: string; action?: React.ReactNode}) {
	return (
		<div className="px-5 py-12 text-center">
			<h3 className="text-sm font-medium text-fg">{title}</h3>
			{description ? <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-fg-muted">{description}</p> : null}
			{action ? <div className="mt-4 flex justify-center">{action}</div> : null}
		</div>
	)
}

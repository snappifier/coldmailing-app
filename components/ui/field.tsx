export function Field({label, hint, error, children}: {label?: string; hint?: React.ReactNode; error?: string; children: React.ReactNode}) {
	return (
		<label className="flex flex-col gap-1.5">
			{label ? <span className="text-[12.5px] font-medium text-fg">{label}</span> : null}
			{children}
			{error ? <span className="text-xs text-danger">{error}</span> : hint ? <span className="text-xs text-fg-faint">{hint}</span> : null}
		</label>
	)
}

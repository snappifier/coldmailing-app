"use client"
// app/(app)/leady/batch-research-launcher.tsx

import {useState} from "react"
import {useRouter} from "next/navigation"
import {previewBatch, startBatch, type PreviewResult} from "@/features/research/batch-actions"

interface TypeOption {
	id: string
	name: string
	kind: "RESEARCH" | "SCORING" | "CONTENT" | "DRAFT"
}

export function BatchResearchLauncher({types, criteria}: {types: TypeOption[]; criteria: {offeringLineId?: string; q?: string}}) {
	const router = useRouter()
	const [open, setOpen] = useState(false)
	const [typeId, setTypeId] = useState(types[0]?.id ?? "")
	const [mode, setMode] = useState<"AUTO" | "MANUAL">("AUTO")
	const [includeRecent, setIncludeRecent] = useState(false)
	const [preview, setPreview] = useState<Extract<PreviewResult, {ok: true}> | null>(null)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)

	if (types.length === 0) return null

	async function onPreview() {
		setError(null)
		setPreview(null)
		setBusy(true)
		const res = await previewBatch(criteria, typeId, includeRecent)
		setBusy(false)
		if (!res.ok) {
			setError(res.error)
			return
		}
		setPreview(res)
	}

	async function onStart() {
		setError(null)
		setBusy(true)
		const res = await startBatch(criteria, typeId, mode, includeRecent)
		if (!res.ok) {
			setBusy(false)
			setError(res.error)
			return
		}
		router.push(`/badania/batches/${res.batchId}`)
	}

	return (
		<div className="rounded border border-border p-3 text-sm">
			<div className="flex items-center justify-between">
				<h2 className="font-semibold text-fg-muted">Badanie zbiorcze</h2>
				<button className="text-accent" type="button" onClick={() => setOpen((v) => !v)}>
					{open ? "Ukryj" : "Uruchom dla filtra"}
				</button>
			</div>
			{open ? (
				<div className="mt-3 flex flex-col gap-2">
					<p className="text-xs text-fg-muted">Uruchomi research dla leadów pasujących do bieżącego filtra (linia + szukaj).</p>
					<div className="flex flex-wrap items-end gap-2">
						<select className="rounded border border-border px-2 py-1" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
							{types.map((t) => (
								<option key={t.id} value={t.id}>
									{t.kind === "SCORING" ? "[Ocena] " : t.kind === "CONTENT" ? "[Treść] " : ""}
								{t.name}
								</option>
							))}
						</select>
						<select className="rounded border border-border px-2 py-1" value={mode} onChange={(e) => setMode(e.target.value as "AUTO" | "MANUAL")}>
							<option value="AUTO">Auto (uzupełnij puste)</option>
							<option value="MANUAL">Ręczne zatwierdzenie</option>
						</select>
						<label className="flex items-center gap-1 text-xs text-fg-muted">
							<input type="checkbox" checked={includeRecent} onChange={(e) => setIncludeRecent(e.target.checked)} />
							researchuj mimo niedawnego (30 dni)
						</label>
						<button className="rounded border border-border px-3 py-1 disabled:opacity-50" type="button" disabled={busy || !typeId} onClick={onPreview}>
							Podgląd
						</button>
					</div>
					{error ? <p className="text-danger">{error}</p> : null}
					{preview ? (
						<div className="flex flex-col gap-2 rounded bg-surface-2 p-2">
							<p className="text-fg">
								Pasujące: {preview.matched} · pominięte (niedawne): {preview.skippedRecent} · do uruchomienia: <span className="font-semibold">{preview.willQueue}</span>
								{preview.truncated ? <span className="text-warning"> (ograniczono do {preview.max})</span> : null}
							</p>
							<button className="self-start rounded bg-primary px-3 py-1.5 text-primary-fg disabled:opacity-50" type="button" disabled={busy || preview.willQueue === 0} onClick={onStart}>
								Uruchom dla {preview.willQueue} leadów
							</button>
						</div>
					) : null}
				</div>
			) : null}
		</div>
	)
}

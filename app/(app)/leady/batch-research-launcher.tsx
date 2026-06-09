"use client"
// app/(app)/leady/batch-research-launcher.tsx

import {useState} from "react"
import {useRouter} from "next/navigation"
import {previewBatch, startBatch, type PreviewResult} from "@/features/research/batch-actions"
import {Select} from "@/components/ui/select"
import {Button} from "@/components/ui/button"
import {Card, CardBody} from "@/components/ui/card"
import {Note} from "@/components/ui/note"

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
		<Card className="text-sm">
			<CardBody className="flex flex-col gap-3 p-3">
				<div className="flex items-center justify-between">
					<h2 className="font-semibold text-fg-muted">Badanie zbiorcze</h2>
					<Button variant="ghost" size="sm" type="button" onClick={() => setOpen((v) => !v)}>
						{open ? "Ukryj" : "Uruchom dla filtra"}
					</Button>
				</div>
				{open ? (
					<div className="flex flex-col gap-2">
						<p className="text-xs text-fg-muted">Uruchomi badania dla leadów pasujących do bieżącego filtra (linia + szukaj).</p>
						<div className="flex flex-wrap items-end gap-2">
							<Select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
								{types.map((t) => (
									<option key={t.id} value={t.id}>
										{t.kind === "SCORING" ? "[Ocena] " : t.kind === "CONTENT" ? "[Treść] " : ""}
										{t.name}
									</option>
								))}
							</Select>
							<Select value={mode} onChange={(e) => setMode(e.target.value as "AUTO" | "MANUAL")}>
								<option value="AUTO">Auto (uzupełnij puste)</option>
								<option value="MANUAL">Ręczne zatwierdzenie</option>
							</Select>
							<label className="flex items-center gap-1 text-xs text-fg-muted">
								<input type="checkbox" checked={includeRecent} onChange={(e) => setIncludeRecent(e.target.checked)} />
								badaj mimo niedawnego (30 dni)
							</label>
							<Button type="button" disabled={busy || !typeId} onClick={onPreview}>
								Podgląd
							</Button>
						</div>
						{error ? <p className="text-danger">{error}</p> : null}
						{preview ? (
							<div className="flex flex-col gap-2 rounded bg-surface-2 p-2">
								<p className="text-fg">
									Pasujące: {preview.matched} · pominięte (niedawne): {preview.skippedRecent} · do uruchomienia: <span className="font-semibold">{preview.willQueue}</span>
								</p>
								{preview.truncated ? (
									<Note variant="warning">Wyniki ograniczono do {preview.max} leadów.</Note>
								) : null}
								<Button className="self-start" variant="primary" type="button" disabled={busy || preview.willQueue === 0} onClick={onStart}>
									Uruchom dla {preview.willQueue} leadów
								</Button>
							</div>
						) : null}
					</div>
				) : null}
			</CardBody>
		</Card>
	)
}

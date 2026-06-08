"use client"
// app/(app)/leady/[id]/uruchom-research.tsx

import {useEffect, useRef, useState} from "react"
import {useRouter} from "next/navigation"
import {startResearch, getResearchRun, confirmResearchApply} from "@/features/research/actions"

interface TypeOption {
	id: string
	name: string
}
interface DiffField {
	key: string
	label: string
	value: string | number | null
	current?: string | number | null
	reason?: string
}
interface RunView {
	status: "QUEUED" | "RUNNING" | "DONE" | "FAILED"
	error: string | null
	diff: {applied: DiffField[]; proposed: DiffField[]; skipped: DiffField[]} | null
}

export function UruchomResearch({leadId, types}: {leadId: string; types: TypeOption[]}) {
	const router = useRouter()
	const [typeId, setTypeId] = useState(types[0]?.id ?? "")
	const [mode, setMode] = useState<"AUTO" | "MANUAL">("AUTO")
	const [runId, setRunId] = useState<string | null>(null)
	const [run, setRun] = useState<RunView | null>(null)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const timer = useRef<ReturnType<typeof setInterval> | null>(null)

	useEffect(
		() => () => {
			if (timer.current) clearInterval(timer.current)
		},
		[],
	)

	function poll(id: string) {
		if (timer.current) clearInterval(timer.current)
		timer.current = setInterval(async () => {
			const r = await getResearchRun(id)
			if (!r) return
			setRun({status: r.status, error: r.error, diff: r.diff as RunView["diff"]})
			if (r.status === "DONE" || r.status === "FAILED") {
				if (timer.current) clearInterval(timer.current)
				setBusy(false)
				router.refresh()
			}
		}, 2000)
	}

	async function onRun() {
		if (!typeId) return
		setError(null)
		setBusy(true)
		setRun({status: "QUEUED", error: null, diff: null})
		const res = await startResearch(leadId, typeId, mode)
		if (!res.ok) {
			setError(res.error)
			setBusy(false)
			return
		}
		setRunId(res.runId)
		poll(res.runId)
	}

	async function onApply() {
		if (!runId) return
		setError(null)
		setBusy(true)
		const result = await confirmResearchApply(runId)
		setBusy(false)
		if (!result.ok) {
			setError(result.error)
			return
		}
		setRun((r) => (r && r.diff ? {...r, diff: {...r.diff, proposed: []}} : r))
		router.refresh()
	}

	const proposed = run?.diff?.proposed ?? []

	return (
		<div className="flex flex-col gap-3 rounded border border-zinc-200 p-3">
			<h2 className="text-sm font-semibold text-zinc-500">Research AI</h2>
			{types.length === 0 ? (
				<p className="text-sm text-zinc-500">
					Brak typów researchu. Dodaj w{" "}
					<a className="underline" href="/badania">
						Badania
					</a>
					.
				</p>
			) : (
				<>
					<div className="flex flex-wrap items-end gap-2 text-sm">
						<select className="rounded border border-zinc-300 px-2 py-1" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
							{types.map((t) => (
								<option key={t.id} value={t.id}>
									{t.name}
								</option>
							))}
						</select>
						<select className="rounded border border-zinc-300 px-2 py-1" value={mode} onChange={(e) => setMode(e.target.value as "AUTO" | "MANUAL")}>
							<option value="AUTO">Auto (uzupełnij puste)</option>
							<option value="MANUAL">Ręczne zatwierdzenie</option>
						</select>
						<button className="rounded bg-zinc-900 px-3 py-1.5 text-white disabled:opacity-50" type="button" disabled={busy} onClick={onRun}>
							Uruchom research
						</button>
					</div>
					{error ? <p className="text-sm text-red-600">{error}</p> : null}
					{run && (run.status === "QUEUED" || run.status === "RUNNING") ? <p className="text-sm text-zinc-500">Trwa research…</p> : null}
					{run?.status === "FAILED" ? <p className="text-sm text-red-600">Błąd: {run.error}</p> : null}
					{run?.status === "DONE" && run.diff ? (
						<div className="flex flex-col gap-2 text-sm">
							{run.diff.applied.length > 0 ? (
								<div>
									<p className="font-medium text-green-700">Zastosowane:</p>
									<ul className="list-disc pl-5">
										{run.diff.applied.map((a) => (
											<li key={a.key}>
												{a.label}: {String(a.value)}
											</li>
										))}
									</ul>
								</div>
							) : null}
							{proposed.length > 0 ? (
								<div>
									<p className="font-medium text-amber-700">Propozycje (zatwierdź):</p>
									<ul className="list-disc pl-5">
										{proposed.map((p) => (
											<li key={p.key}>
												{p.label}: <span className="text-zinc-400 line-through">{String(p.current ?? "—")}</span> → {String(p.value)}
											</li>
										))}
									</ul>
									<button className="mt-1 rounded bg-amber-600 px-3 py-1 text-white disabled:opacity-50" type="button" disabled={busy} onClick={onApply}>
										Zastosuj propozycje
									</button>
								</div>
							) : null}
							{run.diff.skipped.length > 0 ? <p className="text-xs text-zinc-400">Pominięte: {run.diff.skipped.map((s) => `${s.label} (${s.reason})`).join(", ")}</p> : null}
							{run.diff.applied.length === 0 && proposed.length === 0 ? <p className="text-sm text-zinc-500">Brak nowych danych do zastosowania.</p> : null}
						</div>
					) : null}
				</>
			)}
		</div>
	)
}

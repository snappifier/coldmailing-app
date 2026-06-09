"use client"
// app/(app)/badania/batches/[id]/batch-view.tsx

import {useCallback, useEffect, useRef, useState} from "react"
import {getBatch, cancelBatch, resumeFailed, applyBatch} from "@/features/research/batch-actions"
import {confirmResearchApply} from "@/features/research/actions"
import {useConfirm} from "@/components/ui/use-confirm"
import {useToast} from "@/components/ui/use-toast"

type Batch = NonNullable<Awaited<ReturnType<typeof getBatch>>>

const STATUS_LABEL: Record<string, string> = {
	QUEUED: "W kolejce",
	RUNNING: "W toku",
	DONE: "Zakończone",
	PARTIAL: "Częściowe (błędy)",
	CANCELLED: "Anulowane",
	FAILED: "Błąd",
}

function isTerminal(s: string) {
	return s === "DONE" || s === "PARTIAL" || s === "CANCELLED"
}

export function BatchView({batchId, initial}: {batchId: string; initial: Batch}) {
	const [batch, setBatch] = useState<Batch>(initial)
	const [busy, setBusy] = useState(false)
	const [msg, setMsg] = useState<string | null>(null)
	const mounted = useRef(true)
	const ask = useConfirm()
	const notify = useToast()

	// Immediately re-fetch + update local state (the source of truth this component renders).
	const refresh = useCallback(async () => {
		const b = await getBatch(batchId)
		if (b && mounted.current) setBatch(b)
	}, [batchId])

	// Self-scheduling poll: await each fetch before scheduling the next so slow responses can never
	// stack up and overwrite fresher state. Stops once the batch reaches a terminal status.
	useEffect(() => {
		mounted.current = true
		let handle: ReturnType<typeof setTimeout> | null = null
		async function tick() {
			const b = await getBatch(batchId)
			if (!mounted.current) return
			if (b) {
				setBatch(b)
				if (isTerminal(b.status)) return
			}
			handle = setTimeout(tick, 2000)
		}
		handle = setTimeout(tick, 2000)
		return () => {
			mounted.current = false
			if (handle) clearTimeout(handle)
		}
	}, [batchId])

	async function onCancel() {
		if (!(await ask({title: "Anulować badanie zbiorcze?", body: "Oczekujące zadania zostaną anulowane.", confirmLabel: "Anuluj badanie", cancelLabel: "Anuluj", danger: false}))) return
		setBusy(true)
		setMsg(null)
		const res = await cancelBatch(batchId)
		if (!res.ok) setMsg(res.error)
		else {
			notify("Anulowano badanie")
			await refresh()
		}
		setBusy(false)
	}

	async function onResume() {
		setBusy(true)
		setMsg(null)
		const res = await resumeFailed(batchId)
		if (!res.ok) setMsg(res.error)
		else {
			setMsg("Ponowiono nieudane.")
			await refresh()
		}
		setBusy(false)
	}

	async function onApplyAll() {
		setBusy(true)
		setMsg(null)
		const res = await applyBatch(batchId)
		if (!res.ok) setMsg(res.error)
		else setMsg(`Zastosowano ${res.applied} pól${res.emailCollisions ? `, pominięto ${res.emailCollisions} kolizji email` : ""}.`)
		setBusy(false)
	}

	async function onApplyRow(runId: string) {
		setBusy(true)
		setMsg(null)
		const res = await confirmResearchApply(runId)
		if (!res.ok) setMsg(res.error)
		setBusy(false)
	}

	const c = batch.counts
	const terminal = isTerminal(batch.status)

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center gap-3">
				<h1 className="text-lg font-semibold">{batch.name}</h1>
				<span className="rounded bg-surface-2 px-2 py-0.5 text-xs text-fg-muted">{STATUS_LABEL[batch.status] ?? batch.status}</span>
				<span className="text-xs text-fg-muted">{batch.mode === "MANUAL" ? "Ręczne zatwierdzenie" : "Auto"}</span>
			</div>

			<p className="text-sm text-fg-muted">
				Łącznie {batch.total} · DONE {c.DONE} · w toku {c.RUNNING} · w kolejce {c.QUEUED} · błędy {c.FAILED}
				{c.CANCELLED ? ` · anulowane ${c.CANCELLED}` : ""}
			</p>

			<div className="flex flex-wrap gap-2 text-sm">
				{!terminal ? (
					<button className="rounded border border-border px-3 py-1 disabled:opacity-50" type="button" disabled={busy} onClick={onCancel}>
						Anuluj badanie
					</button>
				) : null}
				{c.FAILED > 0 && batch.status !== "CANCELLED" ? (
					<button className="rounded border border-border px-3 py-1 disabled:opacity-50" type="button" disabled={busy} onClick={onResume}>
						Wznów nieudane ({c.FAILED})
					</button>
				) : null}
				{batch.mode === "MANUAL" ? (
					<button className="rounded bg-primary px-3 py-1 text-primary-fg disabled:opacity-50" type="button" disabled={busy || c.DONE === 0} onClick={onApplyAll}>
						Zatwierdź wszystko
					</button>
				) : null}
			</div>
			{msg ? <p className="text-sm text-fg">{msg}</p> : null}

			<table className="w-full border-collapse text-sm">
				<thead>
					<tr className="border-b border-border text-left text-fg-muted">
						<th className="py-1 pr-2">Lead</th>
						<th className="py-1 pr-2">Status</th>
						<th className="py-1 pr-2">Zastosowane</th>
						<th className="py-1 pr-2">Propozycje</th>
						<th className="py-1 pr-2">Błąd</th>
						<th className="py-1 pr-2"></th>
					</tr>
				</thead>
				<tbody>
					{batch.rows.map((r) => (
						<tr className="border-b border-border" key={r.runId}>
							<td className="py-1 pr-2">
								<a className="text-accent hover:underline" href={`/leady/${r.leadId}`}>
									{r.leadName}
								</a>
							</td>
							<td className="py-1 pr-2">{STATUS_LABEL[r.status] ?? r.status}</td>
							<td className="py-1 pr-2">{r.applied}</td>
							<td className="py-1 pr-2">{r.proposed}</td>
							<td className="py-1 pr-2 text-danger">{r.error ?? ""}</td>
							<td className="py-1 pr-2 text-right">
								{batch.mode === "MANUAL" && r.status === "DONE" && r.proposed > 0 ? (
									<button className="text-warning disabled:opacity-50" type="button" disabled={busy} onClick={() => onApplyRow(r.runId)}>
										Zastosuj
									</button>
								) : null}
							</td>
						</tr>
					))}
					{batch.rows.length === 0 ? (
						<tr>
							<td className="py-2 text-fg-muted" colSpan={6}>
								Brak uruchomień.
							</td>
						</tr>
					) : null}
				</tbody>
			</table>
		</div>
	)
}

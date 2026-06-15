"use client"
// app/(app)/badania/batches/[id]/batch-view.tsx

import {useCallback, useEffect, useRef, useState} from "react"
import {getBatch, cancelBatch, resumeFailed, applyBatch} from "@/features/research/batch-actions"
import {confirmResearchApply} from "@/features/research/actions"
import {useConfirm} from "@/components/ui/use-confirm"
import {useToast} from "@/components/ui/use-toast"
import {Button} from "@/components/ui/button"
import {Badge} from "@/components/ui/badge"
import {Table, Th, Td} from "@/components/ui/table"
import {EmptyState} from "@/components/ui/empty-state"
import {ArrowRightIcon} from "@/components/ui/icons"
import {RESEARCH_STATUS_LABEL, RESEARCH_STATUS_VARIANT} from "@/features/enums/labels"

type Batch = NonNullable<Awaited<ReturnType<typeof getBatch>>>

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
		if (!(await ask({title: "Anulować badanie zbiorcze?", body: "Oczekujące zadania zostaną anulowane.", confirmLabel: "Anuluj badanie", cancelLabel: "Wróć", danger: false}))) return
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
				<Badge variant={RESEARCH_STATUS_VARIANT[batch.status] ?? "neutral"}>{RESEARCH_STATUS_LABEL[batch.status] ?? batch.status}</Badge>
				<span className="text-xs text-fg-muted">{batch.mode === "MANUAL" ? "Ręczne zatwierdzenie" : "Auto"}</span>
			</div>

			<p className="text-sm text-fg-muted">
				Łącznie {batch.total} · Gotowe {c.DONE} · w toku {c.RUNNING} · w kolejce {c.QUEUED} · błędy {c.FAILED}
				{c.CANCELLED ? ` · anulowane ${c.CANCELLED}` : ""}
			</p>

			<div className="flex flex-wrap gap-2">
				{!terminal ? (
					<Button type="button" disabled={busy} onClick={onCancel}>
						Anuluj badanie
					</Button>
				) : null}
				{c.FAILED > 0 && batch.status !== "CANCELLED" ? (
					<Button type="button" disabled={busy} onClick={onResume}>
						Wznów nieudane ({c.FAILED})
					</Button>
				) : null}
				{batch.mode === "MANUAL" ? (
					<Button variant="primary" type="button" disabled={busy || c.DONE === 0} onClick={onApplyAll}>
						Zatwierdź wszystko
					</Button>
				) : null}
			</div>
			{msg ? <p className="text-sm text-fg">{msg}</p> : null}

			{batch.rows.length === 0 ? (
				<EmptyState title="Brak uruchomień" description="Badanie nie uruchomiło jeszcze żadnych zadań." />
			) : (
				<Table>
					<thead>
						<tr>
							<Th>Lead</Th>
							<Th>Status</Th>
							<Th>Zastosowane</Th>
							<Th>Propozycje</Th>
							<Th>Błąd</Th>
							<Th>{""}</Th>
						</tr>
					</thead>
					<tbody>
						{batch.rows.map((r) => (
							<tr className="group" key={r.runId}>
								<Td>
									<span className="inline-flex items-center gap-1.5">
										<a className="text-fg font-medium hover:underline underline-offset-2" href={`/leady/${r.leadId}`}>
											{r.leadName}
										</a>
										<ArrowRightIcon className="size-3.5 flex-none -translate-x-0.5 text-fg-faint opacity-0 transition-[opacity,transform] duration-150 ease-out group-hover:translate-x-0.5 group-hover:text-fg group-hover:opacity-100" />
									</span>
								</Td>
								<Td>
									<Badge variant={RESEARCH_STATUS_VARIANT[r.status] ?? "neutral"}>{RESEARCH_STATUS_LABEL[r.status] ?? r.status}</Badge>
								</Td>
								<Td>{r.applied}</Td>
								<Td>{r.proposed}</Td>
								<Td className="text-danger">{r.error ?? ""}</Td>
								<Td className="text-right">
									{batch.mode === "MANUAL" && r.status === "DONE" && r.proposed > 0 ? (
										<Button variant="ghost" size="sm" type="button" disabled={busy} onClick={() => onApplyRow(r.runId)}>
											Zastosuj
										</Button>
									) : null}
								</Td>
							</tr>
						))}
					</tbody>
				</Table>
			)}
		</div>
	)
}

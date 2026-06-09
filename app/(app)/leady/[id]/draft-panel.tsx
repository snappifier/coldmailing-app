"use client"
// app/(app)/leady/[id]/draft-panel.tsx

import {useEffect, useRef, useState} from "react"
import Link from "next/link"
import {startDraft, getDraft, saveDraft} from "@/features/research/draft-actions"

interface TypeOption {
	id: string
	name: string
}
interface DraftView {
	status: "QUEUED" | "RUNNING" | "DONE" | "FAILED"
	subject: string
	body: string
	error: string | null
}

export function DraftPanel({leadId, types, initial}: {leadId: string; types: TypeOption[]; initial: DraftView | null}) {
	const [typeId, setTypeId] = useState(types[0]?.id ?? "")
	const [draft, setDraft] = useState<DraftView | null>(initial)
	const [subject, setSubject] = useState(initial?.subject ?? "")
	const [body, setBody] = useState(initial?.body ?? "")
	const [busy, setBusy] = useState(false)
	const [msg, setMsg] = useState<string | null>(null)
	const timer = useRef<ReturnType<typeof setInterval> | null>(null)

	useEffect(
		() => () => {
			if (timer.current) clearInterval(timer.current)
		},
		[],
	)

	function poll() {
		if (timer.current) clearInterval(timer.current)
		timer.current = setInterval(async () => {
			const d = await getDraft(leadId)
			if (!d) return
			setDraft({status: d.status, subject: d.subject, body: d.body, error: d.error})
			if (d.status === "DONE" || d.status === "FAILED") {
				if (timer.current) clearInterval(timer.current)
				setBusy(false)
				if (d.status === "DONE") {
					setSubject(d.subject)
					setBody(d.body)
				}
			}
		}, 2000)
	}

	async function onGenerate() {
		if (!typeId) return
		setMsg(null)
		setBusy(true)
		setDraft({status: "QUEUED", subject, body, error: null})
		const res = await startDraft(leadId, typeId)
		if (!res.ok) {
			setBusy(false)
			setMsg(res.error)
			return
		}
		poll()
	}

	async function onSave() {
		setMsg(null)
		setBusy(true)
		const res = await saveDraft(leadId, subject, body)
		setBusy(false)
		setMsg(res.ok ? "Zapisano." : res.error)
	}

	return (
		<div className="flex flex-col gap-3 rounded border border-border p-3">
			<h2 className="text-sm font-semibold text-fg-muted">Draft maila (AI)</h2>
			{types.length === 0 ? (
				<p className="text-sm text-fg-muted">
					Brak typów draftu. Dodaj typ „Draft” w{" "}
					<Link className="underline" href="/badania">
						Badania
					</Link>
					.
				</p>
			) : (
				<>
					<div className="flex flex-wrap items-end gap-2 text-sm">
						<select className="rounded border border-border px-2 py-1" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
							{types.map((t) => (
								<option key={t.id} value={t.id}>
									{t.name}
								</option>
							))}
						</select>
						<button className="rounded bg-primary px-3 py-1.5 text-primary-fg disabled:opacity-50" type="button" disabled={busy} onClick={onGenerate}>
							Generuj draft
						</button>
					</div>
					{msg ? <p className="text-sm text-fg">{msg}</p> : null}
					{draft && (draft.status === "QUEUED" || draft.status === "RUNNING") ? <p className="text-sm text-fg-muted">Generowanie draftu…</p> : null}
					{draft?.status === "FAILED" ? <p className="text-sm text-danger">Błąd: {draft.error}</p> : null}
					{draft && draft.status === "DONE" ? (
						<div className="flex flex-col gap-2 text-sm">
							<label className="flex flex-col gap-1">
								<span className="text-xs text-fg-muted">Temat</span>
								<input className="rounded border border-border px-2 py-1" value={subject} onChange={(e) => setSubject(e.target.value)} />
							</label>
							<label className="flex flex-col gap-1">
								<span className="text-xs text-fg-muted">Treść</span>
								<textarea className="min-h-40 rounded border border-border px-2 py-1" value={body} onChange={(e) => setBody(e.target.value)} />
							</label>
							<button className="self-start rounded bg-primary px-3 py-1 text-primary-fg disabled:opacity-50" type="button" disabled={busy} onClick={onSave}>
								Zapisz draft
							</button>
						</div>
					) : null}
				</>
			)}
		</div>
	)
}

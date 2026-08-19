"use client"

import {useEffect, useRef, useState} from "react"
import Link from "next/link"
import {startDraft, getDraft, saveDraft} from "@/features/research/draft-actions"
import {Select} from "@/components/ui/select"
import {Input} from "@/components/ui/input"
import {Textarea} from "@/components/ui/textarea"
import {Button} from "@/components/ui/button"
import {Field} from "@/components/ui/field"
import {Spinner} from "@/components/ui/spinner"

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
			{types.length === 0 ? (
				<p className="text-sm text-fg-muted">
					Brak typów draftu. Dodaj typ &bdquo;Draft&rdquo; w{" "}
					<Link className="text-fg underline underline-offset-2" href="/badania">
						Badania
					</Link>
					.
				</p>
			) : (
				<>
					<div className="flex flex-wrap items-end gap-2 text-sm">
						<Select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
							{types.map((t) => (
								<option key={t.id} value={t.id}>
									{t.name}
								</option>
							))}
						</Select>
						<Button variant="primary" type="button" disabled={busy} onClick={onGenerate}>
							Generuj draft
						</Button>
					</div>
					{msg ? <p className="text-sm text-fg">{msg}</p> : null}
					{draft && (draft.status === "QUEUED" || draft.status === "RUNNING") ? (
						<p className="flex items-center gap-2 text-sm text-fg-muted">
							<Spinner />
							Generowanie draftu…
						</p>
					) : null}
					{draft?.status === "FAILED" ? <p className="text-sm text-danger">Błąd: {draft.error}</p> : null}
					{draft && draft.status === "DONE" ? (
						<div className="flex flex-col gap-2 text-sm">
							<Field label="Temat">
								<Input value={subject} onChange={(e) => setSubject(e.target.value)} />
							</Field>
							<Field label="Treść">
								<Textarea className="min-h-40" value={body} onChange={(e) => setBody(e.target.value)} />
							</Field>
							<Button className="self-start" variant="primary" type="button" disabled={busy} onClick={onSave}>
								Zapisz draft
							</Button>
						</div>
					) : null}
				</>
			)}
		</div>
	)
}

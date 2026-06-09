"use client"
// app/(app)/szablony/template-editor.tsx

import {useActionState, useRef, useState} from "react"
import {createTemplate, type TemplateResult} from "@/features/templates/actions"
import {renderTemplate, type RenderLead, type RenderPlaceholder} from "@/features/templates/render"
import {Input} from "@/components/ui/input"
import {Textarea} from "@/components/ui/textarea"
import {Select} from "@/components/ui/select"
import {Button} from "@/components/ui/button"

const BUILTIN = ["nazwaPlacowki", "osoba", "miasto", "www", "hookAI", "zwrot", "podpisNadawcy"]

interface Props {
	offeringLines: {id: string; name: string}[]
	customPlaceholders: RenderPlaceholder[]
	customKeys: string[]
	sampleLead: RenderLead | null
	senderName: string
	signatureSet: boolean
	previewMailboxName: string | null
}

export function TemplateEditor({offeringLines, customPlaceholders, customKeys, sampleLead, senderName, signatureSet, previewMailboxName}: Props) {
	const [state, action, pending] = useActionState<TemplateResult | null, FormData>(createTemplate, null)
	const [subject, setSubject] = useState("")
	const [body, setBody] = useState("")
	const subjectRef = useRef<HTMLTextAreaElement>(null)
	const bodyRef = useRef<HTMLTextAreaElement>(null)
	const activeRef = useRef<"subject" | "body">("body")

	function insert(token: string) {
		const isSubject = activeRef.current === "subject"
		const el = isSubject ? subjectRef.current : bodyRef.current
		const current = isSubject ? subject : body
		const setVal = isSubject ? setSubject : setBody
		const start = el?.selectionStart ?? current.length
		const end = el?.selectionEnd ?? current.length
		const next = current.slice(0, start) + token + current.slice(end)
		setVal(next)
		setTimeout(() => {
			if (el) {
				el.focus()
				const pos = start + token.length
				el.setSelectionRange(pos, pos)
			}
		}, 0)
	}

	const preview = sampleLead
		? {
				subject: renderTemplate(subject, {lead: sampleLead, senderName, placeholders: customPlaceholders}),
				body: renderTemplate(body, {lead: sampleLead, senderName, placeholders: customPlaceholders}),
			}
		: null
	const missing = preview ? Array.from(new Set([...preview.subject.missing, ...preview.body.missing])) : []

	return (
		<div className="grid gap-6 lg:grid-cols-2">
			<form className="flex flex-col gap-3" action={action}>
				<Input name="name" placeholder="Nazwa szablonu" required />
				<div className="flex flex-wrap gap-1">
					{[...BUILTIN, ...customKeys].map((k) => (
						<Button className="font-mono" key={k} variant="ghost" size="sm" type="button" onClick={() => insert(`{{${k}}}`)}>
							{`{{${k}}}`}
						</Button>
					))}
					<Button className="font-mono" variant="ghost" size="sm" type="button" onClick={() => insert("{{Szanowny|Szanowna}}")}>
						{"{{Szanowny|Szanowna}}"}
					</Button>
				</div>
				<Textarea
					name="subject"
					placeholder="Temat"
					value={subject}
					ref={subjectRef}
					onFocus={() => (activeRef.current = "subject")}
					onChange={(e) => setSubject(e.target.value)}
					required
				/>
				<Textarea
					className="h-48"
					name="body"
					placeholder="Treść wiadomości"
					value={body}
					ref={bodyRef}
					onFocus={() => (activeRef.current = "body")}
					onChange={(e) => setBody(e.target.value)}
					required
				/>
				<label className="flex items-center gap-2 text-sm">
					<input name="isFollowup" type="checkbox" /> Wiadomość follow-up
				</label>
				<Select name="offeringLineId" defaultValue="">
					<option value="">— linia usługi —</option>
					{offeringLines.map((l) => (
						<option key={l.id} value={l.id}>
							{l.name}
						</option>
					))}
				</Select>
				<Button className="w-40" variant="primary" type="submit" disabled={pending}>
					Zapisz szablon
				</Button>
				{state && !state.ok ? <p className="text-sm text-danger">{state.error}</p> : null}
				{state && state.ok ? <p className="text-sm text-success">Zapisano.</p> : null}
			</form>

			<div className="flex flex-col gap-2">
				<h2 className="text-sm font-semibold text-fg">Podgląd {sampleLead ? `(${sampleLead.organizationName})` : "(brak leadów)"}</h2>
				{!signatureSet ? (
					<p className="text-xs text-warning">
						Podpis nadawcy nieustawiony w Ustawieniach — podgląd i wysyłka użyją nazwy skrzynki ({previewMailboxName ?? "—"}). Ustaw podpis, aby był spójny.
					</p>
				) : null}
				<div className="rounded border border-border p-3 text-sm">
					<p className="font-medium">{preview?.subject.rendered || "—"}</p>
					<hr className="my-2 border-border" />
					<p className="whitespace-pre-wrap">{preview?.body.rendered || "—"}</p>
				</div>
				{missing.length > 0 ? (
					<p className="text-xs text-warning">Nierozwiązane / braki: {missing.join(", ")}</p>
				) : (
					<p className="text-xs text-success">Wszystkie tokeny rozwiązane dla tego leada.</p>
				)}
			</div>
		</div>
	)
}

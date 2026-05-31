"use client"
// app/(app)/szablony/template-editor.tsx

import {useActionState, useRef, useState} from "react"
import {createTemplate, type TemplateResult} from "@/features/templates/actions"
import {renderTemplate, type RenderLead, type RenderPlaceholder} from "@/features/templates/render"

const BUILTIN = ["nazwaPlacowki", "osoba", "miasto", "www", "hookAI", "zwrot", "podpisNadawcy"]

interface Props {
	offeringLines: {id: string; name: string}[]
	customPlaceholders: RenderPlaceholder[]
	customKeys: string[]
	sampleLead: RenderLead | null
	senderName: string
}

export function TemplateEditor({offeringLines, customPlaceholders, customKeys, sampleLead, senderName}: Props) {
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
				<input className="rounded border border-zinc-300 px-2 py-1 text-sm" name="name" placeholder="Nazwa szablonu" required />
				<div className="flex flex-wrap gap-1">
					{[...BUILTIN, ...customKeys].map((k) => (
						<button className="rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-50" key={k} type="button" onClick={() => insert(`{{${k}}}`)}>
							{`{{${k}}}`}
						</button>
					))}
					<button className="rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-50" type="button" onClick={() => insert("{{Szanowny|Szanowna}}")}>
						{"{{Szanowny|Szanowna}}"}
					</button>
				</div>
				<textarea
					className="rounded border border-zinc-300 p-2 text-sm"
					name="subject"
					placeholder="Temat"
					value={subject}
					ref={subjectRef}
					onFocus={() => (activeRef.current = "subject")}
					onChange={(e) => setSubject(e.target.value)}
					required
				/>
				<textarea
					className="h-48 rounded border border-zinc-300 p-2 text-sm"
					name="body"
					placeholder="Treść wiadomości"
					value={body}
					ref={bodyRef}
					onFocus={() => (activeRef.current = "body")}
					onChange={(e) => setBody(e.target.value)}
					required
				/>
				<label className="flex items-center gap-2 text-sm">
					<input name="isFollowup" type="checkbox" /> To follow-up
				</label>
				<select className="rounded border border-zinc-300 px-2 py-1 text-sm" name="offeringLineId" defaultValue="">
					<option value="">— linia usługi —</option>
					{offeringLines.map((l) => (
						<option key={l.id} value={l.id}>
							{l.name}
						</option>
					))}
				</select>
				<button className="w-40 rounded bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50" type="submit" disabled={pending}>
					Zapisz szablon
				</button>
				{state && !state.ok ? <span className="text-sm text-red-600">{state.error}</span> : null}
				{state && state.ok ? <span className="text-sm text-green-700">Zapisano.</span> : null}
			</form>

			<div className="flex flex-col gap-2">
				<h2 className="text-sm font-semibold text-zinc-700">Podgląd {sampleLead ? `(${sampleLead.organizationName})` : "(brak leadów)"}</h2>
				<div className="rounded border border-zinc-200 p-3 text-sm">
					<p className="font-medium">{preview?.subject.rendered || "—"}</p>
					<hr className="my-2 border-zinc-100" />
					<p className="whitespace-pre-wrap">{preview?.body.rendered || "—"}</p>
				</div>
				{missing.length > 0 ? (
					<p className="text-xs text-amber-700">Nierozwiązane / braki: {missing.join(", ")}</p>
				) : (
					<p className="text-xs text-green-700">Wszystkie tokeny rozwiązane dla tego leada.</p>
				)}
			</div>
		</div>
	)
}

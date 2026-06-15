"use client"
// app/(app)/szablony/templates-shell.tsx

import {useActionState, useRef, useState} from "react"
import {createTemplate, updateTemplate, deleteTemplate, type TemplateResult} from "@/features/templates/actions"
import {renderTemplate, type RenderLead, type RenderPlaceholder} from "@/features/templates/render"
import {motion, useReducedMotion} from "motion/react"
import {SPRING_SETTLE} from "@/lib/motion"
import {cn} from "@/lib/cn"
import {PageHeader} from "@/components/ui/page-header"
import {Card, CardBody} from "@/components/ui/card"
import {Input} from "@/components/ui/input"
import {Textarea} from "@/components/ui/textarea"
import {Select} from "@/components/ui/select"
import {Switch} from "@/components/ui/switch"
import {Button} from "@/components/ui/button"
import {Note} from "@/components/ui/note"
import {ConfirmButton} from "@/components/ui/confirm-button"
import {useConfirm} from "@/components/ui/use-confirm"
import {useToast} from "@/components/ui/use-toast"

const BUILTIN = ["nazwaPlacowki", "osoba", "miasto", "www", "hookAI", "zwrot", "podpisNadawcy"]

export interface TemplateRow {
	id: string
	name: string
	subject: string
	body: string
	isFollowup: boolean
	offeringLineId: string | null
	offeringLineName: string | null
	inUse: boolean
}

interface Draft {
	name: string
	subject: string
	body: string
	isFollowup: boolean
	offeringLineId: string
}

interface Props {
	templates: TemplateRow[]
	offeringLines: {id: string; name: string}[]
	customPlaceholders: RenderPlaceholder[]
	customKeys: string[]
	sampleLead: RenderLead | null
	senderName: string
	signatureSet: boolean
	previewMailboxName: string | null
}

const EMPTY: Draft = {name: "", subject: "", body: "", isFollowup: false, offeringLineId: ""}

function toDraft(t: TemplateRow): Draft {
	return {name: t.name, subject: t.subject, body: t.body, isFollowup: t.isFollowup, offeringLineId: t.offeringLineId ?? ""}
}

function FieldLabel({children}: {children: React.ReactNode}) {
	return <span className="text-[10px] font-semibold uppercase tracking-[.06em] text-fg-faint">{children}</span>
}

export function TemplatesShell({templates, offeringLines, customPlaceholders, customKeys, sampleLead, senderName, signatureSet, previewMailboxName}: Props) {
	const ask = useConfirm()
	const toast = useToast()
	const reduce = useReducedMotion()
	const [selectedId, setSelectedId] = useState<string | null>(null)
	const [draft, setDraft] = useState<Draft>(EMPTY)
	const [snapshot, setSnapshot] = useState<Draft>(EMPTY)
	const subjectRef = useRef<HTMLTextAreaElement>(null)
	const bodyRef = useRef<HTMLTextAreaElement>(null)
	const activeRef = useRef<"subject" | "body">("body")

	// A deleted template leaves selectedId dangling after revalidation - fall back to new mode at render time.
	const selected = selectedId ? (templates.find((t) => t.id === selectedId) ?? null) : null
	const effectiveId = selected ? selectedId : null
	const dirty = JSON.stringify(draft) !== JSON.stringify(snapshot)

	const [createState, createAction, createPending] = useActionState<TemplateResult | null, FormData>(
		async (prev, formData) => {
			const res = await createTemplate(prev, formData)
			if (res?.ok) {
				toast("Zapisano szablon")
				setSelectedId(res.id)
				setSnapshot({...draft})
			}
			return res
		},
		null,
	)
	const [updateState, updateAction, updatePending] = useActionState<TemplateResult | null, FormData>(
		async (prev, formData) => {
			const res = await updateTemplate(prev, formData)
			if (res?.ok) {
				toast("Zapisano zmiany")
				setSnapshot({...draft})
			}
			return res
		},
		null,
	)

	async function switchTo(id: string | null) {
		if (id !== null && id === effectiveId) return
		if (dirty && !(await ask({title: "Porzucić niezapisane zmiany?", confirmLabel: "Porzuć", cancelLabel: "Wróć", danger: false}))) return
		const next = id ? (templates.find((t) => t.id === id) ?? null) : null
		const d = next ? toDraft(next) : EMPTY
		setSelectedId(next ? id : null)
		setDraft(d)
		setSnapshot(d)
	}

	function insert(token: string) {
		const isSubject = activeRef.current === "subject"
		const el = isSubject ? subjectRef.current : bodyRef.current
		const current = isSubject ? draft.subject : draft.body
		const start = el?.selectionStart ?? current.length
		const end = el?.selectionEnd ?? current.length
		const next = current.slice(0, start) + token + current.slice(end)
		setDraft(isSubject ? {...draft, subject: next} : {...draft, body: next})
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
				subject: renderTemplate(draft.subject, {lead: sampleLead, senderName, placeholders: customPlaceholders}),
				body: renderTemplate(draft.body, {lead: sampleLead, senderName, placeholders: customPlaceholders}),
			}
		: null
	const missing = preview ? Array.from(new Set([...preview.subject.missing, ...preview.body.missing])) : []

	const pending = createPending || updatePending
	const state = effectiveId ? updateState : createState

	return (
		<section className="flex flex-col gap-6">
			<PageHeader
				title="Szablony"
				description="Treści maili z placeholderami i podglądem."
				meta={`${templates.length} szablonów`}
				action={<Button variant="secondary" type="button" onClick={() => switchTo(null)}>+ Nowy szablon</Button>}
			/>
			<div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[200px_minmax(0,1.1fr)_minmax(0,1fr)]">
				<nav className="flex gap-1 max-lg:flex-row max-lg:flex-wrap lg:flex-col">
					{templates.map((t) => {
						const active = t.id === effectiveId
						const meta = [t.offeringLineName, t.inUse ? "w sekwencji" : null].filter(Boolean).join(" · ")
						return (
							<button
								className={cn(
									"relative rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors",
									active ? "bg-surface-2 text-fg" : "text-fg-muted hover:bg-surface-1 hover:text-fg",
								)}
								key={t.id}
								type="button"
								aria-current={active ? "true" : undefined}
								onClick={() => switchTo(t.id)}
							>
								{active ? (
									reduce ? (
										<span className="absolute -left-px top-1/2 h-[15px] w-[2.5px] -translate-y-1/2 rounded bg-accent" />
									) : (
										<motion.span layoutId="templates-rail" className="absolute -left-px top-1/2 h-[15px] w-[2.5px] -translate-y-1/2 rounded bg-accent" transition={SPRING_SETTLE} />
									)
								) : null}
								<span className="flex items-center justify-between gap-2">
									<span className="truncate">{t.name}</span>
									{active && dirty ? <span className="size-[5px] flex-none rounded-full bg-warning" aria-label="Niezapisane zmiany" /> : null}
								</span>
								{meta ? <span className="block truncate text-[10px] text-fg-faint">{meta}</span> : null}
							</button>
						)
					})}
					{templates.length === 0 ? <p className="px-2.5 py-1.5 text-[12.5px] text-fg-muted">Brak szablonów — utwórz pierwszy obok.</p> : null}
				</nav>

				<form className="flex flex-col gap-4" action={effectiveId ? updateAction : createAction}>
					{effectiveId ? <input name="templateId" type="hidden" value={effectiveId} /> : null}
					<div className="flex flex-col gap-1.5">
						<FieldLabel>Nazwa</FieldLabel>
						<Input name="name" value={draft.name} placeholder="Nazwa szablonu" required onChange={(e) => setDraft({...draft, name: e.target.value})} />
					</div>
					<div className="flex flex-col gap-1.5">
						<FieldLabel>Placeholdery — klik wstawia w aktywne pole</FieldLabel>
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
					</div>
					<div className="flex flex-col gap-1.5">
						<FieldLabel>Temat</FieldLabel>
						<Textarea
							className="min-h-0 h-16"
							name="subject"
							placeholder="Temat"
							value={draft.subject}
							ref={subjectRef}
							required
							onFocus={() => (activeRef.current = "subject")}
							onChange={(e) => setDraft({...draft, subject: e.target.value})}
						/>
					</div>
					<div className="flex flex-col gap-1.5">
						<FieldLabel>Treść</FieldLabel>
						<Textarea
							className="h-48"
							name="body"
							placeholder="Treść wiadomości"
							value={draft.body}
							ref={bodyRef}
							required
							onFocus={() => (activeRef.current = "body")}
							onChange={(e) => setDraft({...draft, body: e.target.value})}
						/>
					</div>
					<div className="flex flex-wrap items-center gap-5">
						<span className="flex items-center gap-2 text-sm text-fg">
							<Switch checked={draft.isFollowup} aria-label="Wiadomość follow-up" onChange={(v) => setDraft({...draft, isFollowup: v})} />
							Wiadomość follow-up
						</span>
						<input name="isFollowup" type="hidden" value={draft.isFollowup ? "on" : ""} />
						<Select className="w-56" name="offeringLineId" value={draft.offeringLineId} onChange={(e) => setDraft({...draft, offeringLineId: e.target.value})}>
							<option value="">— linia usługi —</option>
							{offeringLines.map((l) => (
								<option key={l.id} value={l.id}>
									{l.name}
								</option>
							))}
						</Select>
					</div>
					<div className="flex items-center justify-between gap-3 border-t border-border pt-4">
						<Button className="w-44 justify-center" variant="primary" type="submit" disabled={pending}>
							{effectiveId ? "Zapisz zmiany" : "Zapisz szablon"}
						</Button>
						{effectiveId ? (
							selected?.inUse ? (
								<span className="text-xs text-fg-faint">w sekwencji — nie można usunąć</span>
							) : (
								<ConfirmButton action={deleteTemplate.bind(null, effectiveId)} confirm={{title: "Usunąć szablon?", body: "Tej operacji nie można cofnąć.", confirmLabel: "Usuń", danger: true}} toast="Usunięto szablon">
									Usuń
								</ConfirmButton>
							)
						) : null}
					</div>
					{state && !state.ok ? <p className="text-sm text-danger">{state.error}</p> : null}
				</form>

				<div className="self-start lg:col-start-2 xl:col-start-auto xl:sticky xl:top-6">
					<Card>
						<CardBody className="flex flex-col gap-3">
							<FieldLabel>Podgląd {sampleLead ? `· ${sampleLead.organizationName}` : "· brak leadów"}</FieldLabel>
							{!signatureSet ? (
								<Note variant="warning">
									Podpis nadawcy nieustawiony w Ustawieniach — podgląd i wysyłka użyją nazwy skrzynki ({previewMailboxName ?? "—"}). Ustaw podpis, aby był spójny.
								</Note>
							) : null}
							<p className="text-sm font-medium">{preview?.subject.rendered || "—"}</p>
							<hr className="border-border" />
							<p className="whitespace-pre-wrap text-sm">{preview?.body.rendered || "—"}</p>
							{missing.length > 0 ? (
								<p className="text-xs text-warning">Nierozwiązane / braki: {missing.join(", ")}</p>
							) : (
								<p className="text-xs text-success">Wszystkie tokeny rozwiązane dla tego leada.</p>
							)}
						</CardBody>
					</Card>
				</div>
			</div>
		</section>
	)
}

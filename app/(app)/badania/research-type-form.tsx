"use client"

import {useActionState, useEffect, useState} from "react"
import {useRouter} from "next/navigation"
import type {ResearchTypeResult} from "@/features/research-types/actions"
import {CUSTOM_TYPES, TARGET_OPTIONS, derivedTypeForTarget, type FieldType, type Target} from "@/features/research-types/targets"
import type {OutputField} from "@/features/research-types/schema"
import {Input} from "@/components/ui/input"
import {Textarea} from "@/components/ui/textarea"
import {Select} from "@/components/ui/select"
import {Button} from "@/components/ui/button"
import {Badge} from "@/components/ui/badge"
import {Switch} from "@/components/ui/switch"
import {Checkbox} from "@/components/ui/checkbox"
import {Field} from "@/components/ui/field"

const MODEL_OPTIONS = ["claude-haiku-4-5", "claude-sonnet-4-6", "claude-opus-4-8"]

const TARGET_LABEL: Record<string, string> = {
	contactPersonName: "Osoba kontaktowa",
	contactRole: "Stanowisko",
	honorific: "Forma grzecznościowa",
	aiHook: "Hak AI",
	aiNotes: "Notatki AI",
	siteQuality: "Jakość strony",
	priority: "Priorytet",
	score: "Ocena",
	city: "Miasto",
	region: "Region",
	schoolType: "Typ szkoły",
	email: "E-mail",
	CUSTOM: "Pole własne",
}

const FIELD_TYPE_LABEL: Record<string, string> = {
	TEXT: "Tekst",
	NUMBER: "Liczba",
	BOOLEAN: "Tak/Nie",
	EMAIL: "E-mail",
	ENUM: "Lista wyboru",
	GENDER: "Płeć",
}

type Action = (prev: ResearchTypeResult | null, formData: FormData) => Promise<ResearchTypeResult>

interface Initial {
	name: string
	kind: "RESEARCH" | "SCORING" | "CONTENT" | "DRAFT"
	prompt: string
	modelId: string
	webSearchEnabled: boolean
	outputFields: OutputField[]
}

interface Row {
	id: number
	field: OutputField
}

const EMPTY_FIELD: OutputField = {key: "", label: "", target: "CUSTOM", type: "TEXT", required: false, description: null}

export function ResearchTypeForm({action, initial}: {action: Action; initial?: Initial}) {
	const router = useRouter()
	const [state, formAction, pending] = useActionState<ResearchTypeResult | null, FormData>(action, null)
	const initialFields = initial?.outputFields?.length ? initial.outputFields : [{...EMPTY_FIELD}]
	const [rows, setRows] = useState<Row[]>(() => initialFields.map((field, idx) => ({id: idx, field})))
	const [seq, setSeq] = useState(initialFields.length)
	const [kind, setKind] = useState<Initial["kind"]>(initial?.kind ?? "RESEARCH")
	const [webSearchEnabled, setWebSearchEnabled] = useState(initial?.webSearchEnabled ?? false)

	useEffect(() => {
		if (state?.ok) router.push("/badania")
	}, [state, router])

	function update(i: number, patch: Partial<OutputField>) {
		setRows((prev) => prev.map((r, idx) => (idx === i ? {...r, field: {...r.field, ...patch}} : r)))
	}
	function setTarget(i: number, target: Target) {
		const derived = derivedTypeForTarget(target)
		update(i, {target, type: derived ?? "TEXT"})
	}
	function addField() {
		setRows((prev) => [...prev, {id: seq, field: {...EMPTY_FIELD}}])
		setSeq((s) => s + 1)
	}
	function removeField(i: number) {
		setRows((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev))
	}

	return (
		<form className="flex max-w-3xl flex-col gap-4" action={formAction}>
			<input name="outputFields" type="hidden" value={kind === "DRAFT" ? "[]" : JSON.stringify(rows.map((r) => r.field))} />
			{/* hidden mirror of the Switch so the form still submits webSearchEnabled (server reads === "true") */}
			<input name="webSearchEnabled" type="hidden" value={webSearchEnabled ? "true" : ""} />

			<Field label="Nazwa">
				<Input name="name" defaultValue={initial?.name ?? ""} required />
			</Field>

			<Field label="Rodzaj">
				<Select name="kind" value={kind} onChange={(e) => setKind(e.target.value as Initial["kind"])}>
					<option value="RESEARCH">Research (zbieranie danych)</option>
					<option value="SCORING">Ocena (scoring)</option>
					<option value="CONTENT">Treść (content)</option>
					<option value="DRAFT">Draft maila</option>
				</Select>
				{kind === "SCORING" ? (
					<span className="text-xs text-fg-muted">Typ oceny musi mieć pole z celem score (0-100); opcjonalnie priority (1-5) i uzasadnienie (np. aiNotes).</span>
				) : kind === "CONTENT" ? (
					<span className="text-xs text-fg-muted">Typ treści musi mieć pole z celem aiHook lub pole własne (Pole własne); opcjonalnie włącz wyszukiwanie w sieci, by odświeżyć badania.</span>
				) : kind === "DRAFT" ? (
					<span className="text-xs text-fg-muted">Typ draftu pisze cały temat i treść maila; pola wyjściowe nieużywane. Opcjonalnie włącz wyszukiwanie w sieci.</span>
				) : null}
			</Field>

			<Field label="Prompt badania" hint={<>Tokeny jak {"{{nazwaPlacowki}}"}, {"{{miasto}}"}, {"{{www}}"} renderują się per lead w Fazie 2b.</>}>
				<Textarea name="prompt" defaultValue={initial?.prompt ?? ""} required />
			</Field>

			<div className="flex flex-wrap items-end gap-4">
				<Field label="Model">
					<Select name="modelId" defaultValue={initial?.modelId ?? ""}>
						<option value="">(domyślny)</option>
						{MODEL_OPTIONS.map((m) => (
							<option key={m} value={m}>
								{m}
							</option>
						))}
					</Select>
				</Field>
				<div className="flex items-center gap-2 pb-0.5 text-sm">
					<Switch checked={webSearchEnabled} onChange={setWebSearchEnabled} aria-label="Wyszukiwanie w sieci" />
					<span>Wyszukiwanie w sieci włączone</span>
				</div>
			</div>

			{kind !== "DRAFT" ? (
				<div className="flex flex-col gap-2">
					<span className="text-sm font-medium">Pola wyjściowe</span>
					{rows.map((r, i) => {
						const f = r.field
						const locked = f.target !== "CUSTOM"
						return (
							<div className="flex flex-col gap-2 rounded border border-border p-3" key={r.id}>
								<div className="flex flex-wrap items-end gap-2 text-sm">
									<Field label="Etykieta">
										<Input value={f.label} placeholder="Imię dyrektora" onChange={(e) => update(i, {label: e.target.value})} />
									</Field>
									<Field label="Klucz">
										<Input value={f.key} placeholder="dyrektorImie" onChange={(e) => update(i, {key: e.target.value})} />
									</Field>
									<Field label="Cel">
										<Select value={f.target} onChange={(e) => setTarget(i, e.target.value as Target)}>
											{TARGET_OPTIONS.map((t) => (
												<option key={t} value={t}>
													{TARGET_LABEL[t] ?? t}
												</option>
											))}
										</Select>
									</Field>
									<Field label="Typ">
										{locked ? (
											<Badge variant="neutral">{FIELD_TYPE_LABEL[f.type] ?? f.type}</Badge>
										) : (
											<Select value={f.type} onChange={(e) => update(i, {type: e.target.value as FieldType})}>
												{CUSTOM_TYPES.map((t) => (
													<option key={t} value={t}>
														{FIELD_TYPE_LABEL[t] ?? t}
													</option>
												))}
											</Select>
										)}
									</Field>
									<label className="flex items-center gap-1">
										<Checkbox checked={f.required} onChange={(e) => update(i, {required: e.target.checked})} />
										<span className="text-xs text-fg-muted">wymagane</span>
									</label>
									<Button className="ml-auto" variant="ghost" size="sm" type="button" onClick={() => removeField(i)}>
										Usuń
									</Button>
								</div>
								<Field label="Opis dla AI (opcjonalnie)">
									<Input value={f.description ?? ""} placeholder="np. rozpoznaj płeć po imieniu" onChange={(e) => update(i, {description: e.target.value || null})} />
								</Field>
							</div>
						)
					})}
					<Button className="self-start border-dashed" size="sm" type="button" onClick={addField}>
						+ Dodaj pole
					</Button>
				</div>
			) : null}

			<div className="flex items-center gap-3">
				<Button variant="primary" type="submit" disabled={pending}>
					Zapisz
				</Button>
				{state && !state.ok ? <span className="text-sm text-danger">{state.error}</span> : null}
			</div>
		</form>
	)
}

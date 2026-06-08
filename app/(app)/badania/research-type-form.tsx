"use client"
// app/(app)/badania/research-type-form.tsx

import {useActionState, useEffect, useState} from "react"
import {useRouter} from "next/navigation"
import type {ResearchTypeResult} from "@/features/research-types/actions"
import {CUSTOM_TYPES, TARGET_OPTIONS, derivedTypeForTarget, type FieldType, type Target} from "@/features/research-types/targets"
import type {OutputField} from "@/features/research-types/schema"

const MODEL_OPTIONS = ["claude-haiku-4-5", "claude-sonnet-4-6", "claude-opus-4-8"]

type Action = (prev: ResearchTypeResult | null, formData: FormData) => Promise<ResearchTypeResult>

interface Initial {
	name: string
	kind: "RESEARCH" | "SCORING"
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
			<input name="outputFields" type="hidden" value={JSON.stringify(rows.map((r) => r.field))} />

			<label className="flex flex-col gap-1 text-sm">
				<span className="font-medium">Nazwa</span>
				<input className="rounded border border-zinc-300 px-2 py-1" name="name" defaultValue={initial?.name ?? ""} required />
			</label>

			<label className="flex flex-col gap-1 text-sm">
				<span className="font-medium">Rodzaj</span>
				<select className="rounded border border-zinc-300 px-2 py-1" name="kind" defaultValue={initial?.kind ?? "RESEARCH"}>
					<option value="RESEARCH">Research (zbieranie danych)</option>
					<option value="SCORING">Ocena (scoring)</option>
				</select>
				<span className="text-xs text-zinc-500">Typ oceny powinien mieć pole z celem score (0-100), opcjonalnie priority (1-5) i uzasadnienie (np. aiNotes).</span>
			</label>

			<label className="flex flex-col gap-1 text-sm">
				<span className="font-medium">Prompt researchu</span>
				<textarea className="min-h-32 rounded border border-zinc-300 px-2 py-1 font-mono text-xs" name="prompt" defaultValue={initial?.prompt ?? ""} required />
				<span className="text-xs text-zinc-500">Tokeny jak {"{{nazwaPlacowki}}"}, {"{{miasto}}"}, {"{{www}}"} renderują się per lead w Fazie 2b.</span>
			</label>

			<div className="flex flex-wrap items-end gap-4">
				<label className="flex flex-col gap-1 text-sm">
					<span className="font-medium">Model</span>
					<select className="rounded border border-zinc-300 px-2 py-1" name="modelId" defaultValue={initial?.modelId ?? ""}>
						<option value="">(domyślny)</option>
						{MODEL_OPTIONS.map((m) => (
							<option key={m} value={m}>
								{m}
							</option>
						))}
					</select>
				</label>
				<label className="flex items-center gap-2 text-sm">
					<input name="webSearchEnabled" type="checkbox" value="true" defaultChecked={initial?.webSearchEnabled ?? false} />
					<span>Web search włączony</span>
				</label>
			</div>

			<div className="flex flex-col gap-2">
				<span className="text-sm font-medium">Pola wyjściowe</span>
				{rows.map((r, i) => {
					const f = r.field
					const locked = f.target !== "CUSTOM"
					return (
						<div className="flex flex-col gap-2 rounded border border-zinc-300 p-3" key={r.id}>
							<div className="flex flex-wrap items-end gap-2 text-sm">
								<label className="flex flex-col gap-1">
									<span className="text-xs text-zinc-500">Etykieta</span>
									<input className="rounded border border-zinc-300 px-2 py-1" value={f.label} placeholder="Imię dyrektora" onChange={(e) => update(i, {label: e.target.value})} />
								</label>
								<label className="flex flex-col gap-1">
									<span className="text-xs text-zinc-500">Klucz</span>
									<input className="rounded border border-zinc-300 px-2 py-1" value={f.key} placeholder="dyrektorImie" onChange={(e) => update(i, {key: e.target.value})} />
								</label>
								<label className="flex flex-col gap-1">
									<span className="text-xs text-zinc-500">Cel</span>
									<select className="rounded border border-zinc-300 px-2 py-1" value={f.target} onChange={(e) => setTarget(i, e.target.value as Target)}>
										{TARGET_OPTIONS.map((t) => (
											<option key={t} value={t}>
												{t}
											</option>
										))}
									</select>
								</label>
								<label className="flex flex-col gap-1">
									<span className="text-xs text-zinc-500">Typ</span>
									{locked ? (
										<span className="rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-zinc-500">{f.type}</span>
									) : (
										<select className="rounded border border-zinc-300 px-2 py-1" value={f.type} onChange={(e) => update(i, {type: e.target.value as FieldType})}>
											{CUSTOM_TYPES.map((t) => (
												<option key={t} value={t}>
													{t}
												</option>
											))}
										</select>
									)}
								</label>
								<label className="flex items-center gap-1">
									<input type="checkbox" checked={f.required} onChange={(e) => update(i, {required: e.target.checked})} />
									<span className="text-xs text-zinc-500">wymagane</span>
								</label>
								<button className="ml-auto text-red-600" type="button" onClick={() => removeField(i)}>
									Usuń
								</button>
							</div>
							<label className="flex flex-col gap-1 text-sm">
								<span className="text-xs text-zinc-500">Opis dla AI (opcjonalnie)</span>
								<input className="rounded border border-zinc-300 px-2 py-1" value={f.description ?? ""} placeholder="np. rozpoznaj płeć po imieniu" onChange={(e) => update(i, {description: e.target.value || null})} />
							</label>
						</div>
					)
				})}
				<button className="self-start rounded border border-dashed border-zinc-400 px-3 py-1.5 text-sm" type="button" onClick={addField}>
					+ Dodaj pole
				</button>
			</div>

			<div className="flex items-center gap-3">
				<button className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50" type="submit" disabled={pending}>
					Zapisz
				</button>
				{state && !state.ok ? <span className="text-sm text-red-600">{state.error}</span> : null}
			</div>
		</form>
	)
}

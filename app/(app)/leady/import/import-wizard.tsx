"use client"
// app/(app)/leady/import/import-wizard.tsx

import {useMemo, useState, useActionState, useEffect, useRef} from "react"
import Link from "next/link"
import {animate, motion, useReducedMotion} from "motion/react"
import {parseTable, defaultCustomKey, type LeadFieldKey} from "@/features/leads/import"
import {importLeads, type ImportResult} from "@/features/leads/actions"
import {Textarea} from "@/components/ui/textarea"
import {Select} from "@/components/ui/select"
import {Input} from "@/components/ui/input"
import {Button} from "@/components/ui/button"
import {Field} from "@/components/ui/field"
import {Note} from "@/components/ui/note"
import {Table, Th, Td} from "@/components/ui/table"

const EASE_OUT_QUART = [0.165, 0.84, 0.44, 1] as const
const STEP_LABELS = ["Wklej dane", "Mapuj kolumny", "Wynik"] as const

const FIELDS: {key: LeadFieldKey; label: string}[] = [
	{key: "organizationName", label: "Nazwa placówki *"},
	{key: "email", label: "Email"},
	{key: "website", label: "WWW"},
	{key: "contactPersonName", label: "Osoba"},
	{key: "contactRole", label: "Rola"},
	{key: "phone", label: "Telefon"},
	{key: "city", label: "Miasto"},
	{key: "region", label: "Region"},
	{key: "schoolType", label: "Typ szkoły"},
	{key: "honorific", label: "Zwrot (Pan/Pani)"},
]

type Target = {kind: "ignore"} | {kind: "field"; field: LeadFieldKey} | {kind: "custom"; key: string}

// Button-primary classes for link elements (mirrors components/ui/button.tsx base + md size + primary variant).
const primaryLinkClass = "inline-flex items-center gap-2 rounded-md font-medium tracking-[-0.01em] transition-[transform,background,border-color,opacity] duration-150 ease-out active:scale-[.97] h-8 px-3 text-sm bg-primary text-primary-fg hover:opacity-90"

export function ImportWizard({offeringLines}: {offeringLines: {id: string; name: string}[]}) {
	const [text, setText] = useState("")
	const [hasHeader, setHasHeader] = useState(true)
	const [targets, setTargets] = useState<Record<number, Target>>({})
	const [step, setStep] = useState(0)
	const [done, setDone] = useState(false)

	const step0Ref = useRef<HTMLDivElement>(null)
	const step1Ref = useRef<HTMLDivElement>(null)
	const prevStepRef = useRef<number | null>(null)
	const reduce = useReducedMotion()

	const [state, action, pending] = useActionState<ImportResult | null, FormData>(
		async (prev, fd) => {
			const res = await importLeads(prev, fd)
			if (res.ok) setDone(true)
			return res
		},
		null,
	)

	// Imperative slide animation on step change — both steps stay MOUNTED
	// (no AnimatePresence, no key in form) so controlled input values are preserved.
	// Effect performs NO setState on current step (lint react-hooks/set-state-in-effect safe).
	useEffect(() => {
		if (prevStepRef.current === null) {
			prevStepRef.current = step
			return
		}
		if (prevStepRef.current === step) return
		const goingForward = step > prevStepRef.current
		prevStepRef.current = step
		const activeEl = step === 0 ? step0Ref.current : step1Ref.current
		if (!activeEl || reduce) return
		const dir = goingForward ? 12 : -12
		animate(activeEl, {opacity: [0, 1], x: [dir, 0]}, {duration: 0.2, ease: EASE_OUT_QUART})
	}, [step, reduce])

	const allRows = useMemo(() => (text.trim() ? parseTable(text) : []), [text])
	const columnCount = allRows.reduce((max, r) => Math.max(max, r.length), 0)
	const headers = hasHeader ? allRows[0] ?? [] : []
	const dataRows = hasHeader ? Math.max(0, allRows.length - 1) : allRows.length

	// Reset the per-column mapping when the column COUNT changes (a structural re-paste).
	function onText(value: string) {
		const count = value.trim() ? parseTable(value).reduce((m, r) => Math.max(m, r.length), 0) : 0
		if (count !== columnCount) setTargets({})
		setText(value)
	}

	const targetOf = (i: number): Target => targets[i] ?? {kind: "ignore"}
	const selValue = (t: Target) => (t.kind === "field" ? `field:${t.field}` : t.kind === "custom" ? "custom" : "")
	function onSelect(i: number, value: string) {
		if (value === "custom") setTargets({...targets, [i]: {kind: "custom", key: defaultCustomKey(headers[i] ?? null, i)}})
		else if (value.startsWith("field:")) setTargets({...targets, [i]: {kind: "field", field: value.slice(6) as LeadFieldKey}})
		else setTargets({...targets, [i]: {kind: "ignore"}})
	}

	const hasOrgName = Object.values(targets).some((t) => t.kind === "field" && t.field === "organizationName")

	// Effective display step for the progress bar (0-indexed: 0=Wklej, 1=Mapuj, 2=Wynik)
	const displayStep = done && state?.ok ? 2 : step
	const progressPct = displayStep === 0 ? 33 : displayStep === 1 ? 66 : 100

	function resetAll() {
		setDone(false)
		setStep(0)
		setText("")
		setTargets({})
	}

	// First non-empty cell of a column from data rows
	function colPreview(colIdx: number): string {
		const rows = hasHeader ? allRows.slice(1) : allRows
		for (const row of rows) {
			const cell = row[colIdx]?.trim()
			if (cell) return cell
		}
		return ""
	}

	return (
		<div className="flex flex-col gap-4">
			{/* Progress header — shown above both form and result */}
			<div>
				<p className="text-[11px] text-fg-faint">
					Krok {displayStep + 1} z 3 · {STEP_LABELS[displayStep]}
				</p>
				<div className="mt-1.5 h-[2px] overflow-hidden rounded-full bg-surface-3">
					<motion.div
						className="h-full rounded-full bg-fg"
						initial={false}
						animate={{width: `${progressPct}%`}}
						transition={reduce ? {duration: 0} : {type: "spring", visualDuration: 0.25, bounce: 0}}
					/>
				</div>
			</div>

			{/* Result view — shown INSTEAD of the form when done */}
			{done && state?.ok ? (
				<div className="flex flex-col gap-6">
					<div className="flex divide-x divide-border overflow-hidden rounded-lg border border-border bg-surface-1">
						<div className="flex flex-1 flex-col items-center gap-1 px-6 py-5">
							<span className="text-[20px] font-semibold tabular-nums text-success">{state.created}</span>
							<span className="text-[10px] font-semibold uppercase tracking-[.06em] text-fg-faint">Dodane</span>
						</div>
						<div className="flex flex-1 flex-col items-center gap-1 px-6 py-5">
							<span className="text-[20px] font-semibold tabular-nums">{state.duplicateCount}</span>
							<span className="text-[10px] font-semibold uppercase tracking-[.06em] text-fg-faint">Duplikaty</span>
						</div>
						<div className="flex flex-1 flex-col items-center gap-1 px-6 py-5">
							<span className="text-[20px] font-semibold tabular-nums text-warning">{state.suppressedCount}</span>
							<span className="text-[10px] font-semibold uppercase tracking-[.06em] text-fg-faint">Wykluczone</span>
						</div>
						<div className="flex flex-1 flex-col items-center gap-1 px-6 py-5">
							<span className="text-[20px] font-semibold tabular-nums">{state.withoutEmail}</span>
							<span className="text-[10px] font-semibold uppercase tracking-[.06em] text-fg-faint">Bez e-maila</span>
						</div>
					</div>
					<div className="flex items-center gap-3">
						<Button type="button" onClick={resetAll}>Importuj kolejne</Button>
						<Link className={primaryLinkClass} href="/leady">Przejdź do leadów</Link>
					</div>
				</div>
			) : (
				/* ONE form wrapping BOTH steps — both containers always mounted, inactive hidden */
				<form className="flex flex-col gap-4" action={action}>
					{/* Step 0 — Wklej dane */}
					<div ref={step0Ref} hidden={step !== 0} className="flex flex-col gap-4">
						<Textarea
							className="h-48 font-mono text-xs"
							name="text"
							placeholder="Wklej CSV/TSV (np. z arkusza). Pierwszy wiersz = nagłówki."
							value={text}
							onChange={(e) => onText(e.target.value)}
						/>
						<label className="flex items-center gap-2 text-sm">
							<input name="hasHeader" type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} />
							Pierwszy wiersz to nagłówki
						</label>
						{text.trim() ? (
							<p className="text-xs text-fg-faint">
								Wykryto {dataRows} wierszy · {columnCount} kolumn
							</p>
						) : null}
						<div className="flex items-center justify-between gap-3">
							<Link className="text-sm text-fg-muted hover:text-fg hover:underline underline-offset-2" href="/leady">Anuluj</Link>
							<Button
								variant="primary"
								type="button"
								disabled={allRows.length === 0}
								onClick={() => setStep(1)}
							>
								Dalej
							</Button>
						</div>
					</div>

					{/* Step 1 — Mapuj kolumny */}
					<div ref={step1Ref} hidden={step !== 1} className="flex flex-col gap-4">
						{columnCount > 0 ? (
							<div className="overflow-x-auto">
								<Table>
									<thead>
										<tr>
											<Th>Kolumna</Th>
											<Th>Podgląd</Th>
											<Th>Cel</Th>
										</tr>
									</thead>
									<tbody>
										{Array.from({length: columnCount}, (_, i) => {
											const t = targetOf(i)
											const preview = colPreview(i)
											return (
												<tr key={i}>
													<Td className="text-sm font-medium">{headers[i]?.trim() || `Kolumna ${i + 1}`}</Td>
													<Td className="max-w-[180px]">
														<span className="block truncate text-fg-faint text-xs">{preview}</span>
													</Td>
													<Td>
														<div className="flex flex-col gap-1">
															<Select name={`target_${i}`} value={selValue(t)} onChange={(e) => onSelect(i, e.target.value)}>
																<option value="">— ignoruj —</option>
																{FIELDS.map((f) => (
																	<option key={f.key} value={`field:${f.key}`}>{f.label}</option>
																))}
																<option value="custom">Pole własne</option>
															</Select>
															{t.kind === "custom" ? (
																<Input
																	className="border-dashed"
																	name={`customkey_${i}`}
																	placeholder="klucz pola"
																	value={t.key}
																	onChange={(e) => setTargets({...targets, [i]: {kind: "custom", key: e.target.value}})}
																/>
															) : null}
														</div>
													</Td>
												</tr>
											)
										})}
									</tbody>
								</Table>
							</div>
						) : null}
						<Note variant="warning">
							Wskazówka: zmapuj kolumnę Email — bez niej leady wejdą bez adresu i nie wezmą udziału w dedupe ani wysyłce.
						</Note>
						<div className="flex flex-wrap items-end justify-between gap-3">
							<Field label="Linia usługi">
								<Select className="w-56" name="offeringLineId" defaultValue="">
									<option value="">— brak —</option>
									{offeringLines.map((l) => (
										<option key={l.id} value={l.id}>{l.name}</option>
									))}
								</Select>
							</Field>
							<span className="flex items-center gap-2">
								<Button type="button" onClick={() => setStep(0)}>Wstecz</Button>
								<Button
									variant="primary"
									type="submit"
									disabled={pending || !hasOrgName}
								>
									{pending ? "Importuję..." : `Importuj ${dataRows} leadów`}
								</Button>
							</span>
						</div>
						{state && !state.ok ? <p className="text-sm text-danger">{state.error}</p> : null}
					</div>
				</form>
			)}
		</div>
	)
}

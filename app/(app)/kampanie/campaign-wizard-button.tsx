"use client"
import {useActionState, useEffect, useRef, useState} from "react"
import {useRouter} from "next/navigation"
import {animate, motion, useReducedMotion} from "motion/react"
import {EASE_OUT_QUART, SPRING_SETTLE} from "@/lib/motion"
import {createCampaignFromWizard, countWizardLeads, type WizardResult} from "@/features/campaigns/wizard-actions"
import {Modal} from "@/components/ui/modal"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {NumberInput} from "@/components/ui/number-input"
import {Select} from "@/components/ui/select"
import {Textarea} from "@/components/ui/textarea"
import {Field} from "@/components/ui/field"
import {useToast} from "@/components/ui/use-toast"
import {useConfirm} from "@/components/ui/use-confirm"

const STEPS = ["Podstawy", "Wiadomości", "Leady", "Start"] as const
const PALETTE = ["{{zwrot}}", "{{nazwaPlacowki}}", "{{osoba}}", "{{miasto}}", "{{www}}", "{{hookAI}}", "{{podpisNadawcy}}"]
const FOLLOWUP_SLOTS = [1, 2, 3]

interface Props {
	offeringLines: {id: string; name: string}[]
	mailboxes: {id: string; email: string}[]
	placeholderKeys: string[]
	canActivate: boolean
	variant?: "primary" | "secondary"
}

export function CampaignWizardButton({offeringLines, mailboxes, placeholderKeys, canActivate, variant = "primary"}: Props) {
	const [open, setOpen] = useState(false)
	const [step, setStep] = useState(0)
	const [followUps, setFollowUps] = useState<number[]>([])
	const [criteria, setCriteria] = useState({line: "", minScore: "", q: ""})
	const [mailboxId, setMailboxId] = useState(mailboxes.length === 1 ? mailboxes[0].id : "")
	const [leadCount, setLeadCount] = useState<{count: number; sample: string[]} | null>(null)
	const formRef = useRef<HTMLFormElement>(null)
	// One stable ref holding the four step containers (callback refs) - keeps the slide effect's
	// dependency list at [step, reduce].
	const stepRefs = useRef<(HTMLDivElement | null)[]>([])
	const prevStepRef = useRef<number | null>(null)
	const lastFocusedField = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
	const router = useRouter()
	const toast = useToast()
	const ask = useConfirm()
	const reduce = useReducedMotion()

	const [state, formAction, pending] = useActionState<WizardResult | null, FormData>(
		async (prev, formData) => {
			const res = await createCampaignFromWizard(prev, formData)
			if (res.ok) {
				toast(res.activated ? "Kampania aktywna — wysyłka ruszyła" : res.activationError ? `Zapisano szkic. Aktywacja: ${res.activationError}` : "Zapisano szkic kampanii")
				setOpen(false)
				router.push(`/kampanie/${res.campaignId}`)
			}
			return res
		},
		null,
	)

	// Imperative slide on step change - all steps stay MOUNTED (hidden), so uncontrolled values
	// survive; the effect performs NO setState (react-hooks/set-state-in-effect safe).
	useEffect(() => {
		if (prevStepRef.current === null) {
			prevStepRef.current = step
			return
		}
		if (prevStepRef.current === step) return
		const goingForward = step > prevStepRef.current
		prevStepRef.current = step
		const el = stepRefs.current[step]
		if (!el || reduce) return
		animate(el, {opacity: [0, 1], x: [goingForward ? 12 : -12, 0]}, {duration: 0.2, ease: EASE_OUT_QUART})
	}, [step, reduce])

	// Debounced live lead count for step 3.
	useEffect(() => {
		if (!open || step !== 2) return
		let cancelled = false
		const t = setTimeout(async () => {
			try {
				const res = await countWizardLeads({line: criteria.line || null, minScore: criteria.minScore ? Number(criteria.minScore) : null, q: criteria.q || null})
				if (!cancelled) setLeadCount(res)
			} catch {
				// a failed count leaves the previous value on screen; the server re-resolves on submit
			}
		}, 300)
		return () => {
			cancelled = true
			clearTimeout(t)
		}
	}, [open, step, criteria])

	function insertToken(token: string) {
		const el = lastFocusedField.current ?? stepRefs.current[1]?.querySelector<HTMLTextAreaElement>('textarea[name="body_0"]') ?? null
		if (!el) return
		el.setRangeText(token, el.selectionStart ?? el.value.length, el.selectionEnd ?? el.value.length, "end")
		el.focus()
	}

	const next = () => {
		const invalid = stepRefs.current[step]?.querySelector<HTMLInputElement>(":invalid")
		if (invalid) {
			invalid.reportValidity()
			return
		}
		setStep((s) => Math.min(3, s + 1))
	}

	async function close() {
		const dirty = formRef.current && new FormData(formRef.current).get("name")
		if (dirty && !(await ask({title: "Odrzucić szkic kampanii?", body: "Wpisane treści nie zostaną zapisane.", confirmLabel: "Odrzuć", danger: true}))) return
		setOpen(false)
		setStep(0)
		setFollowUps([])
		setCriteria({line: "", minScore: "", q: ""})
		setLeadCount(null)
		formRef.current?.reset()
	}

	const trackFocus = {onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {lastFocusedField.current = e.currentTarget}}

	const message = (i: number, removable: boolean) => (
		<div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-2/50 p-3" key={i}>
			<div className="flex items-center justify-between">
				<span className="text-[10px] font-semibold uppercase tracking-[.06em] text-fg-faint">{i === 0 ? "Wiadomość startowa" : `Follow-up ${i}`}</span>
				{removable ? (
					<button className="text-[11px] text-fg-faint hover:text-danger" type="button" onClick={() => setFollowUps((f) => f.filter((n) => n !== i))}>usuń</button>
				) : null}
			</div>
			{i > 0 ? (
				<Field label="Wyślij po (dni bez odpowiedzi)">
					<NumberInput className="w-24" name={`delay_${i}`} min={1} max={30} defaultValue={4} required />
				</Field>
			) : null}
			<Field label="Temat">
				<Input name={`subject_${i}`} required={i === 0} {...trackFocus} />
			</Field>
			<Field label="Treść">
				<Textarea name={`body_${i}`} rows={5} required={i === 0} {...trackFocus} />
			</Field>
		</div>
	)

	return (
		<>
			<Button variant={variant} type="button" onClick={() => setOpen(true)}>+ Nowa kampania</Button>
			<Modal open={open} onClose={close} title="Nowa kampania" width={640}
				footer={
					<>
						<span />
						<span className="flex gap-2">
							{step > 0 ? <Button type="button" onClick={() => setStep((s) => s - 1)}>Wstecz</Button> : <Button type="button" onClick={close}>Anuluj</Button>}
							{step < 3 ? (
								<Button variant="primary" type="button" onClick={next}>Dalej</Button>
							) : (
								<>
									<Button type="submit" form="campaign-wizard-form" name="mode" value="draft" disabled={pending}>Zapisz jako szkic</Button>
									{canActivate ? (
										<Button variant="primary" type="submit" form="campaign-wizard-form" name="mode" value="activate" disabled={pending || !mailboxId || !leadCount || leadCount.count === 0}>Aktywuj teraz</Button>
									) : null}
								</>
							)}
						</span>
					</>
				}
			>
				<div className="mb-3">
					<p className="text-[11px] text-fg-faint">Krok {step + 1} z 4 · {STEPS[step]}</p>
					<div className="mt-1.5 h-[2px] overflow-hidden rounded-full bg-surface-3">
						<motion.div className="h-full rounded-full bg-fg" initial={false} animate={{width: `${((step + 1) / 4) * 100}%`}} transition={reduce ? {duration: 0} : SPRING_SETTLE} />
					</div>
				</div>
				<form id="campaign-wizard-form" ref={formRef} action={formAction}>
					<div className="flex flex-col gap-3" ref={(el) => {stepRefs.current[0] = el}} hidden={step !== 0}>
						<Field label="Nazwa kampanii"><Input name="name" placeholder="np. Strony WWW — Małopolska Q3" required /></Field>
						<Field label="Linia usługi">
							<Select name="offeringLineId" defaultValue="">
								<option value="">— brak —</option>
								{offeringLines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
							</Select>
						</Field>
					</div>
					<div className="flex flex-col gap-3" ref={(el) => {stepRefs.current[1] = el}} hidden={step !== 1}>
						<div className="flex flex-wrap gap-1.5">
							{[...PALETTE, ...placeholderKeys.map((k) => `{{${k}}}`)].map((t) => (
								<button className="rounded-sm border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[10.5px] text-fg-muted hover:border-border-strong hover:text-fg" type="button" key={t} onClick={() => insertToken(t)}>{t}</button>
							))}
						</div>
						{message(0, false)}
						{followUps.map((i) => message(i, true))}
						{followUps.length < FOLLOWUP_SLOTS.length ? (
							<button className="rounded-lg border border-dashed border-border-strong px-3 py-2 text-[12px] text-fg-muted hover:border-fg-faint hover:text-fg" type="button" onClick={() => setFollowUps((f) => {
								// Slots are fixed 1..3 (the parser reads subject_1..3) - reuse the lowest free one.
								const free = FOLLOWUP_SLOTS.find((n) => !f.includes(n))
								return free === undefined ? f : [...f, free].sort((a, b) => a - b)
							})}>+ dodaj follow-up</button>
						) : null}
					</div>
					<div className="flex flex-col gap-3" ref={(el) => {stepRefs.current[2] = el}} hidden={step !== 2}>
						<Field label="Linia usługi">
							<Select name="filter_line" value={criteria.line} onChange={(e) => setCriteria((c) => ({...c, line: e.target.value}))}>
								<option value="">— wszystkie —</option>
								{offeringLines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
							</Select>
						</Field>
						<div className="grid grid-cols-2 gap-3">
							<Field label="Min. score"><NumberInput name="filter_minScore" min={0} max={100} value={criteria.minScore} onChange={(e) => setCriteria((c) => ({...c, minScore: e.target.value}))} /></Field>
							<Field label="Szukaj"><Input name="filter_q" value={criteria.q} onChange={(e) => setCriteria((c) => ({...c, q: e.target.value}))} /></Field>
						</div>
						<div className="rounded-lg border border-border bg-surface-2/50 px-3 py-2.5">
							<p className="text-[13px] font-semibold text-fg">{leadCount ? `Obejmie ${leadCount.count} leadów` : "Liczenie…"}</p>
							{leadCount && leadCount.sample.length > 0 ? <p className="mt-0.5 truncate text-[11px] text-fg-faint">{leadCount.sample.join(" · ")}{leadCount.count > leadCount.sample.length ? ` +${leadCount.count - leadCount.sample.length}` : ""}</p> : null}
							<p className="mt-1 text-[10.5px] text-fg-faint">Wykluczenia i duplikaty pomijane automatycznie.</p>
						</div>
					</div>
					<div className="flex flex-col gap-3" ref={(el) => {stepRefs.current[3] = el}} hidden={step !== 3}>
						<div className="rounded-lg border border-border bg-surface-2/50 px-3 py-2.5 text-[12.5px] text-fg-muted">
							<p>Wiadomości: <span className="font-semibold tabular-nums text-fg">{1 + followUps.length}</span></p>
							<p>Leady: <span className="font-semibold tabular-nums text-fg">{leadCount?.count ?? 0}</span></p>
						</div>
						{canActivate ? (
							<Field label="Skrzynka wysyłkowa">
								<Select name="mailboxId" value={mailboxId} onChange={(e) => setMailboxId(e.target.value)}>
									<option value="">— wybierz —</option>
									{mailboxes.map((m) => <option key={m.id} value={m.id}>{m.email}</option>)}
								</Select>
							</Field>
						) : (
							<p className="text-[12px] text-fg-faint">Skrzynkę i aktywację ustawia administrator — kampania zapisze się jako szkic.</p>
						)}
					</div>
					{state && !state.ok ? <p className="mt-3 text-sm text-danger">{state.error}</p> : null}
				</form>
			</Modal>
		</>
	)
}

"use client"
// app/(app)/leady/lead-create-button.tsx
import {useActionState, useEffect, useRef, useState} from "react"
import Link from "next/link"
import {animate, motion, useReducedMotion} from "motion/react"
import {createLead, type LeadActionResult} from "@/features/leads/actions"
import {Modal} from "@/components/ui/modal"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Select} from "@/components/ui/select"
import {Field} from "@/components/ui/field"
import {useToast} from "@/components/ui/use-toast"

const EASE_OUT_QUART = [0.165, 0.84, 0.44, 1] as const
const STEPS = ["Organizacja", "Kontakt"] as const

export function LeadCreateButton({offeringLines, variant = "primary"}: {offeringLines: {id: string; name: string}[]; variant?: "primary" | "secondary"}) {
	const [open, setOpen] = useState(false)
	const [step, setStep] = useState(0)
	const formRef = useRef<HTMLFormElement>(null)
	const step0Ref = useRef<HTMLDivElement>(null)
	const step1Ref = useRef<HTMLDivElement>(null)
	const prevStepRef = useRef<number | null>(null)
	const toast = useToast()
	const reduce = useReducedMotion()

	const [state, formAction, pending] = useActionState<LeadActionResult | null, FormData>(
		async (prev, formData) => {
			const res = await createLead(prev, formData)
			if (res.ok) {
				toast("Dodano leada")
				formRef.current?.reset()
				setStep(0)
				setOpen(false)
			}
			return res
		},
		null,
	)

	// Imperative slide animation on step change — both steps stay MOUNTED
	// (no AnimatePresence, no key in form) so uncontrolled input values are preserved.
	// Effect performs NO setState (lint react-hooks/set-state-in-effect safe).
	useEffect(() => {
		if (prevStepRef.current === null) {
			// initial mount — no animation
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

	const next = () => {
		const invalid = step0Ref.current?.querySelector<HTMLInputElement>(":invalid")
		if (invalid) {
			invalid.reportValidity()
			return
		}
		setStep(1)
	}

	const close = () => {
		setOpen(false)
		setStep(0)
	}

	return (
		<>
			<Button variant={variant} type="button" onClick={() => setOpen(true)}>+ Dodaj leada</Button>
			<Modal
				open={open}
				onClose={close}
				title="Nowy lead"
				footer={
					<>
						{step === 0 ? (
							<Link className="text-[11.5px] text-accent hover:underline" href="/leady/import" onClick={close}>Importuj z CSV →</Link>
						) : <span />}
						<span className="flex gap-2">
							{step === 0 ? (
								<>
									<Button type="button" onClick={close}>Anuluj</Button>
									<Button variant="primary" type="button" onClick={next}>Dalej</Button>
								</>
							) : (
								<>
									<Button type="button" onClick={() => setStep(0)}>Wstecz</Button>
									<Button variant="primary" type="submit" form="lead-wizard-form" disabled={pending}>Dodaj leada</Button>
								</>
							)}
						</span>
					</>
				}
			>
				<div className="mb-3">
					<p className="text-[11px] text-fg-faint">Krok {step + 1} z 2 · {STEPS[step]}</p>
					<div className="mt-1.5 h-[2px] overflow-hidden rounded-full bg-surface-3">
						<motion.div
							className="h-full rounded-full bg-accent"
							initial={false}
							animate={{width: step === 0 ? "50%" : "100%"}}
							transition={reduce ? {duration: 0} : {type: "spring", visualDuration: 0.25, bounce: 0}}
						/>
					</div>
				</div>
				<form id="lead-wizard-form" ref={formRef} action={formAction}>
					{/* Both step containers ALWAYS mounted — hidden attribute hides inactive step.
					    Uncontrolled input values survive step changes because there is NO key remount. */}
					<div
						ref={step0Ref}
						hidden={step !== 0}
						className="flex flex-col gap-3"
					>
						<Field label="Nazwa organizacji">
							<Input name="organizationName" placeholder="np. LO im. Kopernika, Warszawa" required />
						</Field>
						<div className="grid grid-cols-2 gap-3">
							<Field label="WWW"><Input name="website" placeholder="https://…" /></Field>
							<Field label="Miasto"><Input name="city" /></Field>
						</div>
						<Field label="Linia usługi">
							<Select name="offeringLineId" defaultValue="">
								<option value="">— brak —</option>
								{offeringLines.map((l) => (
									<option key={l.id} value={l.id}>{l.name}</option>
								))}
							</Select>
						</Field>
					</div>
					<div
						ref={step1Ref}
						hidden={step !== 1}
						className="flex flex-col gap-3"
					>
						<Field label="Osoba kontaktowa"><Input name="contactPersonName" /></Field>
						<div className="grid grid-cols-2 gap-3">
							<Field label="Stanowisko"><Input name="contactRole" placeholder="np. dyrektor" /></Field>
							<Field label="Forma grzecznościowa">
								<Select name="honorific" defaultValue="">
									<option value="">—</option>
									<option value="PANI">Pani</option>
									<option value="PAN">Pan</option>
								</Select>
							</Field>
						</div>
						<Field label="E-mail"><Input name="email" type="email" placeholder="adres@szkola.pl" /></Field>
						<div className="grid grid-cols-2 gap-3">
							<Field label="Telefon"><Input name="phone" /></Field>
							<Field label="Region"><Input name="region" /></Field>
						</div>
					</div>
					{state && !state.ok ? <p className="mt-3 text-sm text-danger">{state.error}</p> : null}
				</form>
			</Modal>
		</>
	)
}

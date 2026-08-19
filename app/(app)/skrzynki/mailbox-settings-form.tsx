"use client"
import {useActionState, useEffect} from "react"
import {updateEmailAccountSettings, type EmailAccountSettingsResult} from "@/features/email-accounts/actions"
import {formatTime, maskToDays} from "@/features/email-accounts/settings"
import {Field} from "@/components/ui/field"
import {Input} from "@/components/ui/input"
import {Select} from "@/components/ui/select"
import {Button} from "@/components/ui/button"
import {useToast} from "@/components/ui/use-toast"

const DAY_LABELS = ["Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"]

interface Account {
	id: string
	dailyLimit: number
	sendWindowStartMin: number
	sendWindowEndMin: number
	sendDays: number
	minGapSec: number
	maxGapSec: number
	timezone: string
}

export function MailboxSettingsForm({account, timezones}: {account: Account; timezones: string[]}) {
	const [state, action, pending] = useActionState<EmailAccountSettingsResult | null, FormData>(updateEmailAccountSettings, null)
	const toast = useToast()
	useEffect(() => { if (state?.ok) toast("Zapisano ustawienia skrzynki") }, [state, toast])
	const days = maskToDays(account.sendDays)
	const tzOptions = timezones.includes(account.timezone) ? timezones : [account.timezone, ...timezones]

	return (
		<form className="flex flex-col gap-3 border-t border-border pt-3" action={action}>
			<input type="hidden" name="id" value={account.id} />
			<div className="flex flex-wrap gap-4">
				<Field label="Dzienny limit">
					<div className="w-28"><Input type="number" name="dailyLimit" min={1} max={1000} step={1} defaultValue={account.dailyLimit} /></div>
				</Field>
				<Field label="Okno wysyłki">
					<div className="flex items-center gap-2">
						<div className="w-28"><Input type="time" name="windowStart" defaultValue={formatTime(account.sendWindowStartMin)} /></div>
						<span className="text-fg-faint">–</span>
						<div className="w-28"><Input type="time" name="windowEnd" defaultValue={formatTime(account.sendWindowEndMin)} /></div>
					</div>
				</Field>
				<Field label="Strefa czasowa">
					<Select className="w-48" name="timezone" defaultValue={account.timezone}>
						{tzOptions.map((tz) => (
							<option key={tz} value={tz}>{tz}</option>
						))}
					</Select>
				</Field>
			</div>
			<Field label="Dni wysyłki">
				<div className="flex gap-1.5">
					{DAY_LABELS.map((label, i) => (
						<label className="cursor-pointer" key={label}>
							<input className="peer sr-only" type="checkbox" name={`day_${i}`} defaultChecked={days[i]} />
							<span className="grid h-8 w-9 place-items-center rounded-md border border-border bg-surface-2 text-xs font-semibold text-fg-faint peer-checked:border-accent peer-checked:bg-accent-quiet peer-checked:text-accent peer-focus-visible:[outline:2px_solid_var(--ring)] peer-focus-visible:outline-offset-2">{label}</span>
						</label>
					))}
				</div>
			</Field>
			<Field label="Odstęp między mailami" hint="Losowy odstęp (sekundy) między kolejnymi mailami.">
				<div className="flex items-center gap-2">
					<div className="w-24"><Input type="number" name="gapMin" min={0} max={86400} step={1} defaultValue={account.minGapSec} /></div>
					<span className="text-fg-faint">–</span>
					<div className="w-24"><Input type="number" name="gapMax" min={0} max={86400} step={1} defaultValue={account.maxGapSec} /></div>
					<span className="text-xs text-fg-faint">s</span>
				</div>
			</Field>
			{state && !state.ok ? <span className="text-sm text-danger">{state.error}</span> : null}
			<Button className="w-fit" type="submit" variant="primary" disabled={pending}>Zapisz ustawienia</Button>
		</form>
	)
}

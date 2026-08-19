"use client"

import {useState} from "react"
import {Button} from "@/components/ui/button"
import {Modal} from "@/components/ui/modal"
import {CampaignForm} from "./campaign-form"

export function KampaniaCreateButton({offeringLines, variant = "primary"}: {offeringLines: {id: string; name: string}[]; variant?: "primary" | "secondary"}) {
	const [open, setOpen] = useState(false)
	return (
		<>
			<Button variant={variant} type="button" onClick={() => setOpen(true)}>+ Nowa kampania</Button>
			<Modal open={open} onClose={() => setOpen(false)} title="Nowa kampania">
				<CampaignForm offeringLines={offeringLines} onSuccess={() => setOpen(false)} />
			</Modal>
		</>
	)
}

"use client"
import {useTransition} from "react"
import {useRouter} from "next/navigation"
import {seedDemoData, clearDemoData} from "@/features/demo/actions"
import {useToast} from "@/components/ui/use-toast"
import {useConfirm} from "@/components/ui/use-confirm"
import {Spinner} from "@/components/ui/spinner"
import {DatabaseIcon} from "@/components/ui/icons"

export function DevSeed({seeded}: {seeded: boolean}) {
	const [pending, start] = useTransition()
	const router = useRouter()
	const toast = useToast()
	const ask = useConfirm()

	async function onClick() {
		if (seeded) {
			const ok = await ask({
				title: "Usunąć dane demo?",
				body: "Zniknie ok. 52 leadów demo, 3 kampanie, 4 szablony, wiadomości i aktywności. Realne dane (bez znacznika demo) zostają nietknięte.",
				confirmLabel: "Usuń demo",
				danger: true,
			})
			if (!ok) return
		}
		start(async () => {
			const res = seeded ? await clearDemoData() : await seedDemoData()
			toast(res.ok ? res.message : res.error)
			router.refresh()
		})
	}

	return (
		<button
			className="fixed bottom-[18px] right-[18px] z-50 flex items-center gap-1.5 rounded-md border border-border bg-surface-1 px-2.5 py-1.5 text-xs text-fg-muted shadow-pop transition-colors duration-150 hover:border-border-strong hover:text-fg disabled:opacity-50"
			type="button"
			disabled={pending}
			onClick={onClick}
		>
			{pending ? <Spinner className="size-3.5" /> : <DatabaseIcon className="size-3.5" />}
			{pending ? "Pracuję..." : seeded ? "Usuń dane demo" : "Wypełnij danymi demo"}
		</button>
	)
}

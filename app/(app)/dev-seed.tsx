"use client"
import {useEffect, useState, useTransition} from "react"
import {useRouter} from "next/navigation"
import {seedDemoData, clearDemoData, simulateDemoTick} from "@/features/demo/actions"
import {toggleSkeletonPreview, useSkeletonPreview} from "./dev-skeleton"
import {cn} from "@/lib/cn"
import {useToast} from "@/components/ui/use-toast"
import {useConfirm} from "@/components/ui/use-confirm"
import {Spinner} from "@/components/ui/spinner"
import {DatabaseIcon} from "@/components/ui/icons"

// Dev-only corner widget: seed/clear the demo dataset, plus a live-environment simulator - while
// demo data is seeded (and the toggle is on) a random event fires every 7-14s (send, reply,
// pipeline move or a new lead), so the dashboard rolls, morphs and flashes like a real workday.
// Ticks pause while the tab is hidden.
export function DevSeed({seeded}: {seeded: boolean}) {
	const [pending, start] = useTransition()
	const [sim, setSim] = useState(true)
	const router = useRouter()
	const toast = useToast()
	const ask = useConfirm()

	useEffect(() => {
		if (!sim || !seeded) return
		let alive = true
		let t: ReturnType<typeof setTimeout>
		const tick = async () => {
			if (!alive) return
			if (!document.hidden) {
				await simulateDemoTick()
				if (!alive) return
				router.refresh()
			}
			t = setTimeout(tick, 7000 + Math.random() * 7000)
		}
		t = setTimeout(tick, 3000)
		return () => {
			alive = false
			clearTimeout(t)
		}
	}, [sim, seeded, router])

	async function onToggleData() {
		if (seeded) {
			const ok = await ask({
				title: "Usunąć dane demo?",
				body: "Zniknie ok. 52 leadów demo, 3 kampanie, 4 szablony, wiadomości i aktywności (także te z symulacji). Realne dane zostają nietknięte.",
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

	const skeletons = useSkeletonPreview()
	return (
		<div className="fixed bottom-[18px] right-[18px] z-50 flex items-center gap-1.5">
			<button
				className={cn(
					"flex items-center gap-1.5 rounded-md border border-border bg-surface-1 px-2.5 py-1.5 text-xs shadow-pop transition-colors duration-150 hover:border-border-strong",
					skeletons ? "text-fg" : "text-fg-muted",
				)}
				type="button"
				onClick={toggleSkeletonPreview}
			>
				<span className={cn("size-[5px] rounded-full", skeletons ? "animate-pulse bg-warning" : "bg-fg-faint")} />
				{skeletons ? "Skeletony: podgląd" : "Skeletony"}
			</button>
			{seeded && (
				<button
					className={cn(
						"flex items-center gap-1.5 rounded-md border border-border bg-surface-1 px-2.5 py-1.5 text-xs shadow-pop transition-colors duration-150 hover:border-border-strong",
						sim ? "text-fg" : "text-fg-muted",
					)}
					type="button"
					onClick={() => setSim((s) => !s)}
				>
					<span className={cn("size-[5px] rounded-full", sim ? "animate-pulse bg-success" : "bg-fg-faint")} />
					{sim ? "Symulacja działa" : "Symulacja wstrzymana"}
				</button>
			)}
			<button
				className="flex items-center gap-1.5 rounded-md border border-border bg-surface-1 px-2.5 py-1.5 text-xs text-fg-muted shadow-pop transition-colors duration-150 hover:border-border-strong hover:text-fg disabled:opacity-50"
				type="button"
				disabled={pending}
				onClick={onToggleData}
			>
				{pending ? <Spinner className="size-3.5" /> : <DatabaseIcon className="size-3.5" />}
				{pending ? "Pracuję..." : seeded ? "Usuń dane demo" : "Wypełnij danymi demo"}
			</button>
		</div>
	)
}

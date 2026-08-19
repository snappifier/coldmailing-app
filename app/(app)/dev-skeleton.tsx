"use client"
import {useSyncExternalStore} from "react"
import {usePathname} from "next/navigation"
import GenericLoading from "@/app/(app)/loading"
import PulpitLoading from "@/app/(app)/(pulpit)/loading"
import LeadyLoading from "@/app/(app)/leady/loading"
import LeadDetailLoading from "@/app/(app)/leady/[id]/loading"
import PipelineLoading from "@/app/(app)/pipeline/loading"
import SzablonyLoading from "@/app/(app)/szablony/loading"
import UstawieniaLoading from "@/app/(app)/ustawienia/loading"
import SkrzynkiLoading from "@/app/(app)/skrzynki/loading"
import CampaignDetailLoading from "@/app/(app)/kampanie/[id]/loading"

// Dev-only skeleton preview: a module-level store (same idiom as the sidebar collapse flag) that
// the corner toggle flips; when on, the gate swaps the page content for the route's REAL
// loading.tsx so skeletons can be eyeballed and tuned without throttling the network.
let previewOn = false
const listeners = new Set<() => void>()
export function toggleSkeletonPreview() {
	previewOn = !previewOn
	listeners.forEach((l) => l())
}
export function useSkeletonPreview(): boolean {
	return useSyncExternalStore(
		(cb) => {
			listeners.add(cb)
			return () => listeners.delete(cb)
		},
		() => previewOn,
		() => false,
	)
}

function skeletonFor(pathname: string): React.ReactNode {
	if (pathname === "/") return <PulpitLoading />
	if (pathname === "/leady") return <LeadyLoading />
	if (pathname === "/leady/import") return <GenericLoading />
	if (pathname.startsWith("/leady/")) return <LeadDetailLoading />
	if (pathname === "/pipeline") return <PipelineLoading />
	if (pathname === "/szablony") return <SzablonyLoading />
	if (pathname === "/ustawienia") return <UstawieniaLoading />
	if (pathname === "/skrzynki") return <SkrzynkiLoading />
	if (pathname.startsWith("/kampanie/")) return <CampaignDetailLoading />
	return <GenericLoading />
}

export function DevSkeletonGate({children}: {children: React.ReactNode}) {
	const on = useSkeletonPreview()
	const pathname = usePathname()
	if (!on) return children
	return skeletonFor(pathname)
}

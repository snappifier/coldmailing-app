"use client"
import {useEffect} from "react"
import {useRouter} from "next/navigation"

// Live dashboard: re-fetches the pulpit's server data on an interval (same idiom as the
// uruchom-research poller). Skips ticks while the tab is hidden - the numbers roll to their new
// values when the user is actually looking, and a background tab does not hammer Neon.
export function LiveRefresh({intervalMs = 30_000}: {intervalMs?: number}) {
	const router = useRouter()
	useEffect(() => {
		const id = setInterval(() => {
			if (!document.hidden) router.refresh()
		}, intervalMs)
		return () => clearInterval(id)
	}, [router, intervalMs])
	return null
}

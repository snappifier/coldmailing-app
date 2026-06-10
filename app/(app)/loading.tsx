// app/(app)/loading.tsx
import {Spinner} from "@/components/ui/spinner"
export default function Loading() {
	return (
		<div className="grid place-items-center py-24">
			<div className="flex flex-col items-center gap-3 text-fg-faint">
				<Spinner />
				<span className="text-[12.5px]">Wczytywanie…</span>
			</div>
		</div>
	)
}

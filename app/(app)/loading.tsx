// app/(app)/loading.tsx
import {Spinner} from "@/components/ui/spinner"
export default function Loading() {
	return <div className="grid place-items-center py-24 text-fg-faint"><Spinner /></div>
}

// app/not-found.tsx
import {EmptyState} from "@/components/ui/empty-state"
export default function NotFound() {
	return <div className="grid min-h-screen place-items-center bg-bg text-fg"><EmptyState title="404" description="Nie znaleziono strony." /></div>
}

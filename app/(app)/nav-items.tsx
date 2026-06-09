// app/(app)/nav-items.tsx
import type {Role} from "@/generated/prisma/client"
import {HomeIcon, UsersIcon, ColumnsIcon, LayersIcon, FileTextIcon, BracesIcon, SearchIcon, SendIcon, InboxIcon, BanIcon, SettingsIcon} from "@/components/ui/icons"

export interface NavItem {href: string; label: string; Icon: ({className}: {className?: string}) => React.ReactNode; minRole?: Role}
export interface NavGroup {label: string; items: NavItem[]}

export const NAV_GROUPS: NavGroup[] = [
	{label: "Sprzedaż", items: [
		{href: "/", label: "Pulpit", Icon: HomeIcon},
		{href: "/leady", label: "Leady", Icon: UsersIcon},
		{href: "/pipeline", label: "Pipeline", Icon: ColumnsIcon},
	]},
	{label: "Treści", items: [
		{href: "/linie", label: "Linie usług", Icon: LayersIcon},
		{href: "/szablony", label: "Szablony", Icon: FileTextIcon},
		{href: "/placeholdery", label: "Placeholdery", Icon: BracesIcon},
	]},
	{label: "Wysyłka", items: [
		{href: "/badania", label: "Badania", Icon: SearchIcon},
		{href: "/kampanie", label: "Kampanie", Icon: SendIcon},
		{href: "/skrzynki", label: "Skrzynki", Icon: InboxIcon, minRole: "ADMIN"},
		{href: "/suppression", label: "Suppression", Icon: BanIcon},
	]},
]

export const SETTINGS_ITEM: NavItem = {href: "/ustawienia", label: "Ustawienia", Icon: SettingsIcon, minRole: "ADMIN"}

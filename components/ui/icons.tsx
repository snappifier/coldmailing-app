type IconProps = {className?: string}

function Svg({className, children}: {className?: string; children: React.ReactNode}) {
	return (
		<svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
			{children}
		</svg>
	)
}

export function CheckIcon({className}: IconProps) {
	return <Svg className={className}><path d="M20 6L9 17l-5-5" /></Svg>
}
export function SunIcon({className}: IconProps) {
	return <Svg className={className}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Svg>
}
export function MoonIcon({className}: IconProps) {
	return <Svg className={className}><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 109.8 9.8z" /></Svg>
}
export function WarningIcon({className}: IconProps) {
	return <Svg className={className}><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" /></Svg>
}
export function SaveIcon({className}: IconProps) {
	return <Svg className={className}><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" /><path d="M17 21v-8H7v8M7 3v5h8" /></Svg>
}
export function HomeIcon({className}: IconProps) {
	return <Svg className={className}><path d="M3 9.5L12 3l9 6.5" /><path d="M5 9.2V20h14V9.2" /><path d="M9.5 20v-6h5v6" /></Svg>
}
export function UsersIcon({className}: IconProps) {
	return <Svg className={className}><circle cx="9" cy="8" r="3.4" /><path d="M2.6 20a6.4 6.4 0 0112.8 0" /><path d="M16.2 5.3a3.4 3.4 0 010 5.4M21.4 20a6.4 6.4 0 00-4.6-6.1" /></Svg>
}
export function ColumnsIcon({className}: IconProps) {
	return <Svg className={className}><rect x="3" y="5" width="5" height="14" rx="1.2" /><rect x="9.5" y="5" width="5" height="9" rx="1.2" /><rect x="16" y="5" width="5" height="12" rx="1.2" /></Svg>
}
export function LayersIcon({className}: IconProps) {
	return <Svg className={className}><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5" /></Svg>
}
export function FileTextIcon({className}: IconProps) {
	return <Svg className={className}><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" /><path d="M14 3v5h5" /><path d="M8 13h8M8 17h6" /></Svg>
}
export function BracesIcon({className}: IconProps) {
	return <Svg className={className}><path d="M8 4c-2 0-3 1-3 3v2c0 1-1 2-2 2 1 0 2 1 2 2v2c0 2 1 3 3 3" /><path d="M16 4c2 0 3 1 3 3v2c0 1 1 2 2 2-1 0-2 1-2 2v2c0 2-1 3-3 3" /></Svg>
}
export function SearchIcon({className}: IconProps) {
	return <Svg className={className}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></Svg>
}
export function SendIcon({className}: IconProps) {
	return <Svg className={className}><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></Svg>
}
export function InboxIcon({className}: IconProps) {
	return <Svg className={className}><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.5 5h13l3.5 7v6a1 1 0 01-1 1H3a1 1 0 01-1-1v-6l3.5-7z" /></Svg>
}
export function BanIcon({className}: IconProps) {
	return <Svg className={className}><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" /></Svg>
}
export function SettingsIcon({className}: IconProps) {
	return <Svg className={className}><circle cx="12" cy="12" r="3" /><path d="M19.4 13.5a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1V21a2 2 0 11-4 0v-.1a1.6 1.6 0 00-2.7-1.1l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00-1.1-2.7H3a2 2 0 110-4h.1a1.6 1.6 0 001.1-2.7l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 002.7-1.1V3a2 2 0 114 0v.1a1.6 1.6 0 002.7 1.1l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8z" /></Svg>
}
export function ChevronLeftIcon({className}: IconProps) {
	return <Svg className={className}><path d="M15 18l-6-6 6-6" /></Svg>
}
export function ArrowRightIcon({className}: IconProps) {
	return <Svg className={className}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>
}
export function ChevronUpIcon({className}: IconProps) {
	return <Svg className={className}><path d="M6 15l6-6 6 6" /></Svg>
}
export function ChevronDownIcon({className}: IconProps) {
	return <Svg className={className}><path d="M6 9l6 6 6-6" /></Svg>
}
export function LogOutIcon({className}: IconProps) {
	return <Svg className={className}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></Svg>
}

"use client"
// app/(app)/ustawienia/team-table.tsx

import {useTransition} from "react"
import type {TeamMember, PendingInvitation} from "@/features/team/queries"
import type {Role} from "@/generated/prisma/client"
import {changeMemberRole, removeMember, cancelInvitation} from "@/features/team/actions"
import {ownerCount} from "@/features/team/guards"
import {ROLE_LABEL} from "@/features/enums/labels"
import {Table, Th, Td} from "@/components/ui/table"
import {Badge} from "@/components/ui/badge"
import {Select} from "@/components/ui/select"
import {ConfirmButton} from "@/components/ui/confirm-button"
import {useToast} from "@/components/ui/use-toast"

function RoleSelect({membershipId, role}: {membershipId: string; role: Role}) {
	const toast = useToast()
	const [pending, startTransition] = useTransition()
	return (
		<form
			action={(formData) =>
				startTransition(async () => {
					const res = await changeMemberRole(membershipId, formData)
					toast(res.ok ? "Zmieniono rolę" : res.error)
				})
			}
		>
			<Select
				className="w-44"
				name="role"
				defaultValue={role}
				disabled={pending}
				onChange={(e) => e.currentTarget.form?.requestSubmit()}
			>
				<option value="MEMBER">{ROLE_LABEL.MEMBER}</option>
				<option value="ADMIN">{ROLE_LABEL.ADMIN}</option>
				<option value="OWNER">{ROLE_LABEL.OWNER}</option>
			</Select>
		</form>
	)
}

export function TeamTable({members, invitations}: {members: TeamMember[]; invitations: PendingInvitation[]}) {
	const owners = ownerCount(members.map((m) => ({membershipId: m.membershipId, role: m.role})))
	return (
		<Table>
			<thead>
				<tr>
					<Th>Osoba</Th>
					<Th>Rola</Th>
					<Th>Od</Th>
					<Th>{""}</Th>
				</tr>
			</thead>
			<tbody>
				{members.map((m) => {
					const lastOwner = m.role === "OWNER" && owners <= 1
					return (
						<tr key={m.membershipId}>
							<Td>
								<span className="text-sm font-semibold text-fg">{m.name ?? m.email}</span>
								<div className="text-[11px] text-fg-faint">{m.email}</div>
							</Td>
							<Td>
								{lastOwner ? (
									<Badge variant="info">{ROLE_LABEL.OWNER}</Badge>
								) : (
									<RoleSelect membershipId={m.membershipId} role={m.role} />
								)}
							</Td>
							<Td className="text-fg-muted">{m.since.toLocaleDateString("pl-PL")}</Td>
							<Td className="text-right">
								{lastOwner ? (
									<span className="text-fg-faint">—</span>
								) : (
									<ConfirmButton
										action={removeMember.bind(null, m.membershipId)}
										confirm={{
											title: "Usunąć członka?",
											body: "Ta osoba straci dostęp do aplikacji i nie zaloguje się ponownie.",
											confirmLabel: "Usuń",
											cancelLabel: "Wróć",
											danger: true,
										}}
										toast="Usunięto członka"
									>
										Usuń
									</ConfirmButton>
								)}
							</Td>
						</tr>
					)
				})}
				{invitations.map((i) => (
					<tr className="opacity-75" key={i.id}>
						<Td>
							<span className="text-sm text-fg-muted">{i.email}</span>
							<div className="text-[11px] text-fg-faint">
								zaproszenie · {i.createdAt.toLocaleDateString("pl-PL")}
							</div>
						</Td>
						<Td>
							<Badge>{ROLE_LABEL[i.role]}</Badge>
						</Td>
						<Td>
							<Badge variant="warn">Oczekuje</Badge>
						</Td>
						<Td className="text-right">
							<ConfirmButton
								action={cancelInvitation.bind(null, i.id)}
								confirm={{
									title: "Anulować zaproszenie?",
									body: "Ten e-mail nie będzie mógł się zalogować.",
									confirmLabel: "Anuluj zaproszenie",
									cancelLabel: "Wróć",
									danger: true,
								}}
								toast="Anulowano zaproszenie"
							>
								Anuluj
							</ConfirmButton>
						</Td>
					</tr>
				))}
			</tbody>
		</Table>
	)
}

import type {TeamMember, PendingInvitation} from "@/features/team/queries"
import {InviteForm} from "./invite-form"
import {TeamTable} from "./team-table"

export function TeamSection({members, invitations}: {members: TeamMember[]; invitations: PendingInvitation[]}) {
	return (
		<div className="flex flex-col gap-4">
			<InviteForm />
			<TeamTable members={members} invitations={invitations} />
		</div>
	)
}

// app/api/inngest/route.ts
import {serve} from "inngest/next"
import {inngest} from "@/lib/inngest/client"
import {helloWorld} from "@/lib/inngest/functions"
import {runLeadSequence} from "@/lib/inngest/sending"
import {scanMailboxesForReplies, pollMailboxReplies} from "@/lib/inngest/replies"
import {runResearchFn} from "@/lib/inngest/research"
import {runResearchBatchFn} from "@/lib/inngest/research-batch"
import {runDraftFn} from "@/lib/inngest/draft"

export const {GET, POST, PUT} = serve({client: inngest, functions: [helloWorld, runLeadSequence, scanMailboxesForReplies, pollMailboxReplies, runResearchFn, runResearchBatchFn, runDraftFn]})

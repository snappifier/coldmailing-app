// app/api/inngest/route.ts
import {serve} from "inngest/next"
import {inngest} from "@/lib/inngest/client"
import {helloWorld} from "@/lib/inngest/functions"
import {sendCampaignEmail} from "@/lib/inngest/sending"

export const {GET, POST, PUT} = serve({client: inngest, functions: [helloWorld, sendCampaignEmail]})

# Music Release Manager MCP app

Work-in-progress ChatGPT app adapted from the official OpenAI MCP server/UI quickstart:
https://developers.openai.com/plugins/build/app-quickstart

The app is hosted on Railway. Changes to this repository's `main` branch trigger the configured Railway deployment when automatic deployments are enabled. ChatGPT submission and approval are separate processes.

## Run locally

```sh
cd chatgpt-app
npm ci
npm run check
PORT=8790 npm start
```

The MCP endpoint is `/mcp`. Tools compute results from user-supplied details without external account access. ChatGPT renders focused MCP Apps widgets for release planning, content, campaign briefs, artist operations, audio analysis, and funding support. The audio tool accepts a file supplied through ChatGPT, measures technical properties and embedded tags, and presents loudness/dynamics plus a clearly labelled tempo estimate. It does not infer mood as fact, retain the file, edit the master, register metadata, or submit a release. The production Docker image includes FFmpeg for this measurement. The campaign workspace does not access Ads Manager, retrieve live prices or policies, add payment, buy ads, launch campaigns, or report performance. The host model writes creative content; the app server does not generate image files, browse or fill forms, or publish or submit anything. The Norway artist support tool provides general, role-aware next steps and official starting points, but does not verify current funding deadlines or eligibility. The funding catalog can store only public program records and official-source check results when `DATABASE_URL` is configured; it never stores artist inputs or application drafts. Earlier release phases are unverified, not automatically completed. Readiness percentages measure only the six supplied checklist answers, not real DSP availability or overall release success.

## Funding catalog updates

The maintained starter catalog uses official Music Norway URLs and the Musikkontoret directory. It is deliberately conservative: a successful source check only confirms that the official URL responded. The artist must still verify the current deadline, eligibility, budget rules and required documents directly with the funder.

For a persistent catalog in Railway, attach a PostgreSQL service and configure its `DATABASE_URL` on this service. The container runs `npm run migrate` at boot, which safely creates and seeds the public catalog. Schedule `npm run funding:check` as a separate daily Railway cron service to record official-source availability. The check does not scrape or infer eligibility rules, and it does not handle artist data.

## Production and submission notes

- Use the configured Railway service and its stable public HTTPS domain for `/mcp`.
- Review privacy and terms drafts, hosting logs/retention, and support details before ChatGPT submission.
- Set `OPENAI_APPS_CHALLENGE` to the portal's domain verification token when required.
- Test in ChatGPT Developer Mode, including widget rendering and error behavior.
- Complete publisher identity verification and Apps Management access in OpenAI Platform.
- Generate review artifacts with six positive and three negative test cases, then submit for review.

No OpenAI API key is needed by this server. ChatGPT supplies the conversational model; the server packages structured drafts and performs deterministic checklist computations.

## Validation reached

TypeScript check and local MCP initialize, tools/list, and plan tool invocation passed. Check Railway deployment status, ChatGPT UI host behavior, domain verification, policy review, and submission independently.

Official submission guidance: https://developers.openai.com/plugins/deploy/submission

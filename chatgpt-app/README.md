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

The MCP endpoint is `/mcp`. Tools compute results from user-supplied details without persistent storage or external account access. The Artist Content Studio packages model-written copy, social and short-video ideas, image prompts, and proposed form-field values in a copyable widget. The host model writes the creative content; the app server does not generate image files, browse or fill forms, or publish or submit anything. The Norway artist support tool provides general, role-aware next steps and official starting points, but does not verify current funding deadlines or eligibility. Earlier release phases are unverified, not automatically completed. Readiness percentages measure only the six supplied checklist answers, not real DSP availability or overall release success.

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

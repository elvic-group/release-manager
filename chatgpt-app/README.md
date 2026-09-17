# Music Release Manager MCP app

Work-in-progress ChatGPT app adapted from the official OpenAI MCP server/UI quickstart:
https://developers.openai.com/plugins/build/app-quickstart

This is not yet deployed, submitted, approved, or published in ChatGPT.

## Run locally

```sh
cd chatgpt-app
npm ci
npm run check
PORT=8790 npm start
```

The MCP endpoint is `/mcp`. Both tools compute results from user-supplied details without persistent storage or external account access. Earlier release phases are unverified, not automatically completed. Readiness percentages measure only the six supplied checklist answers, not real DSP availability or overall release success.

## Production setup still required

- Choose and authorize a hosting provider and any charges; deploy from this directory as the service root.
- Use a stable public HTTPS domain for `/mcp`; configure the widget's `ui.domain` after the host is known.
- Review privacy and terms drafts, hosting logs/retention, and support details before publication.
- Set `OPENAI_APPS_CHALLENGE` to the portal's domain verification token when required.
- Test in ChatGPT Developer Mode, including widget rendering and error behavior.
- Complete publisher identity verification and Apps Management access in OpenAI Platform.
- Generate review artifacts with five positive and three negative test cases, then submit for review.

No OpenAI API key is needed by this server. ChatGPT supplies the conversational model; the server performs deterministic checklist computations.

## Validation reached

TypeScript check and local MCP initialize, tools/list, and plan tool invocation passed. Production deployment, ChatGPT UI host testing, domain verification, policy review, and submission remain pending.

Official submission guidance: https://developers.openai.com/plugins/deploy/submission

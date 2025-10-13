# CF AI Book Recommender

A real-time book recommendation website on Cloudflare Workers. Ask for a genre, a type of book, or a book similar to one you like, and get AI-powered recommendations delivered live over WebSockets.

## Features

1) Ask for recommendations
- Type a prompt like “hard sci‑fi,” “cozy mystery,” or “books like Mistborn by Brandon Sanderson.”
- The app uses Workers AI to interpret your request and generate tailored recommendations.

2) Displays five books with rich details
- Shows five recommended books with:
	- Title and Author
	- Book cover image (via Google Books)
	- A short AI description related to your query
	- A link to the Google Books page for the title

## How it works (high level)

- Frontend (in `frontend/`)
	- Simple HTML/CSS page opens a WebSocket to the backend at `/ws`.
	- Submits your prompt; renders responses in-page as they arrive.

- Backend (in `src/`)
	- `worker.js` exports the Worker entry and a Durable Object `WebSocketServer`.
	- All `/ws` upgrades are routed to the Durable Object, which manages connected clients and message fan‑out.
	- On each client message, the DO triggers a Cloudflare Workflow instance with `{ query, socketId }`.
	- `workflow.js` (BookRecommenderWorkflow) orchestrates the AI steps:
		- Calls Workers AI to produce a structured list of five book suggestions (title/author).
		- Uses Google Books to find covers and info links.
		- Formats a short AI description for the top results.
		- Posts results back to the Durable Object, which sends them to the correct WebSocket client.

## Why Workflows + Durable Objects?

- Durable Objects (DO)
	- Provide a single, ordered, stateful place to manage all WebSocket sessions (per room/key).
	- Guarantee message ordering and make targeted fan‑out to a specific `socketId` straightforward.

- Cloudflare Workflows
	- Orchestrate multi‑step, potentially long‑running tasks (AI calls, external API lookups, formatting).
	- Offer step‑level retries and durable state so an intermittent failure doesn’t drop the whole interaction.
	- Improve observability with per‑step logs and instance status.

Together, DOs handle live connections and routing, while Workflows handle durable, reliable background work.

## Architecture (data flow)

```
Browser ──WS──> Durable Object (WebSocketServer) ── triggers ──> Workflow (BookRecommenderWorkflow)
	 ▲                     │                                           │
	 │                     │<── POST /send (results) ──────────────────┘
	 │                 env.WEBSOCKET_SERVER                      this.env.AI (Workers AI)
	 │                                                           Google Books HTTP API
	 └────── render titles, covers, descriptions, links ──────────────────────────────
```

Key files
- `src/worker.js`
	- Worker `fetch` handler: serves static assets and forwards `/ws` to the DO.
	- Durable Object `WebSocketServer`: accepts sockets, tracks `socketId`s, triggers Workflow instances, and delivers results back to the right client.
- `src/workflow.js`
	- `BookRecommenderWorkflow`: uses `this.env.AI` for model calls and `fetch`es Google Books, then posts results back to the DO at `https://do/send`.
- `frontend/index.html`, `frontend/styles.css`
	- Minimal UI, WebSocket client, and rendering logic.

## Tech stack

- Cloudflare Workers (runtime + static assets)
- Durable Objects (stateful WebSocket hub)
- Cloudflare Workflows (durable multi‑step orchestration)
- Workers AI (LLM for understanding requests and drafting descriptions)
- Google Books API (covers, links, metadata)
- WebSockets (real‑time UX)

## Local development

Prerequisites
- Node.js 18+
- Wrangler CLI

Setup
1) Install dependencies
	 - `npm install`
2) Configure local secrets (git‑ignored)
	 - Copy `.dev.vars.example` to `.dev.vars`
	 - Set your Google Books API key:
		 - `GBOOKS_API_KEY="your-key"`
3) Start the dev server
	 - `npx wrangler dev`
4) Open the app
	 - http://localhost:8787

This project demonstrates a modern, reliable pattern on Cloudflare: DOs for real‑time stateful connections, and Workflows for durable AI/HTTP orchestration.
/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export default {
  async fetch(request, env) {
    const message = [
      { role: "system", content: "you are a friendly ai assistant"},
      { role: "user", content: "how many US presidents are there?"}
    ]
    const response = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {message})

    return new Response(JSON.stringify(response))
  }
}
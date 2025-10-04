export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // --- WebSocket endpoint ---
    if (url.pathname === "/ws") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected websocket", { status: 426 });
      }

      const pair = new WebSocketPair();
      const [client, server] = [pair[0], pair[1]];
      handleWebSocket(server, env);

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    // --- API endpoint ---
    if (url.pathname === "/api/recommend" && request.method === "POST") {
      const body = await request.json();
      const aiResponse = await getAIRecommendation(body.query, env);
      return new Response(JSON.stringify({ recommendation: aiResponse }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // --- Otherwise, serve frontend assets ---
    return env.ASSETS.fetch(request);
  },
};

// --- Shared AI function ---
async function getAIRecommendation(query, env) {
  const prompt = {
    messages: [
      { role: "system", content: "You are a book recommendation system." },
      { role: "user", content: query || "Recommend a good book." },
    ],
    max_tokens: 1024,
  };
  return await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", prompt);
}

// --- WebSocket handler ---
function handleWebSocket(ws, env) {
  ws.accept();
  ws.addEventListener("message", async (event) => {
    try {
      const aiResponse = await getAIRecommendation(event.data, env);
      ws.send(JSON.stringify(aiResponse));
    } catch (err) {
      ws.send(JSON.stringify({ error: "AI request failed" }));
    }
  });
}

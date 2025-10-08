

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    
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

    

  
    return env.ASSETS.fetch(request);
  },
};


async function getAIRecommendation(query, env) {
  const prompt = {
    messages: [
      { role: "system", content: "You are a book recommendation system." },
      { role: "user", content: query || "Recommend a good book." },
    ],
    max_tokens: 1024,
  };
  console.log(query);
  return await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", prompt);
}


function handleWebSocket(ws, env) {
  ws.accept();
  ws.addEventListener("message", async (event) => {
    try {
      const aiResponse = await getAIRecommendation(event.data, env);
      console.log(aiResponse);
      ws.send(JSON.stringify(aiResponse));
      console.log("ai response sent");
    } catch (err) {
      ws.send(JSON.stringify({ error: "AI request failed" }));
    }
  });
}

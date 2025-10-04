
export default {
  async fetch(request, env) {
     const url = new URL(request.url);

    // --- WebSocket endpoint ---
    if (url.pathname === "/ws") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected websocket", { status: 426 });
      }

      const [client, server] = Object.values(new WebSocketPair());
      this.handleWebSocket(server, env);
      return new Response(null, { status: 101, webSocket: client });
    }

    const prompt = {
      messages: [
      {role: "system", content: "You are a book recomendation system"},
      {role: "user", content: "give me a book like harry potter limit your resonse to 5 books"},
      ],
      max_tokens: 4096
  }
    const response = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast",prompt)
     
    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json'}
      })
          
    },   

        

  
      

    }

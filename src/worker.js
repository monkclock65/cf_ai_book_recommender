export {BookRecommenderWorkflow} from "./workflow.js";

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      
      if (url.pathname === "/ws") {
        if (request.headers.get("Upgrade") !== "websocket") {
          return new Response("Expected websocket", { status: 426 });
        }
        const id = env.WEBSOCKET_SERVER.idFromName("websocket");
        const obj = env.WEBSOCKET_SERVER.get(id);
        const response = await obj.fetch(request);
        return response;
      }
      
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error("Worker error:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  }
};

  export class WebSocketServer {
    constructor(state, env) {
      this.state = state;
      this.sessions = new Map();
      this.env = env;
    }

    async fetch(request) {
      console.log("Env keys in DO:", Object.keys(this.env));
      try {
        const url = new URL(request.url);
        console.log("WebSocketServer fetch called, URL:", url.pathname);

        if (url.pathname === "/send" && request.method === "POST") {
          const { socketId, query, apiOutput, aiDescription, error } = await request.json();
          for (const [ws, { id }] of this.sessions) {
            if (id === socketId) {
              const key = `recs:${socketId}`;
              const historyArray = (await this.state.storage.get(key)) || [];
              historyArray.push({ ts: Date.now(), query, apiOutput, aiDescription, ...(error ? { error } : {}) });
              const capped = historyArray.slice(-20);
              await this.state.storage.put(key, capped);
              const latest = capped[capped.length - 1];
              ws.send(JSON.stringify({ query, apiOutput, aiDescription, historyItem: latest, history: capped, ...(error ? { error } : {}) }));
              console.log("AI response sent to client:", id, { latest });
            }
          }

          return new Response("Message sent");
        }

        if (request.headers.get("Upgrade") === "websocket") {
          const pair = new WebSocketPair();
          const [client, server] = Object.values(pair);
          
          server.accept();
          
          const id = crypto.randomUUID();
          this.sessions.set(server, { id });

      server.addEventListener("message", async (event) => {
            try {
        const data = JSON.parse(event.data);
        const query = typeof data === "string" ? data.trim() : (typeof data?.payload === "string" ? data.payload.trim() : "");
        console.log("Received WS message:", data, "from id:", id);

              // Ignore empty payloads to avoid spawning duplicate/blank workflows
              if (query) {
                // Trigger the Workflow instance with params per Cloudflare Workflows API
                await this.env.Book_Recommender.create({
                  params: { query, socketId: id },
                });
              }
            } catch (err) {
              server.send(JSON.stringify({ error: err.message }));
              console.error("WebSocket message error:", err);
            }
          });

          server.addEventListener("close", () => {
            this.sessions.delete(server);
          });

          server.addEventListener("error", (err) => {
            console.error("WebSocket error:", err);
            this.sessions.delete(server);
          });

          return new Response(null, {
            status: 101,
            webSocket: client,
          });
        }

        return new Response("Expected WebSocket", { status: 426 });
      } catch (error) {
        console.error("WebSocket server error:", error);
        return new Response("Internal Server Error", { status: 500 });
      }
    }
  }
  

  



  

import {DurableObject} from "cloudflare:workers";
export {BookRecommenderWorkflow} from "./workflow.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    
    if (url.pathname === "/ws") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected websocket", { status: 426 });
      }
      let id = env.WEBSOCKET_SERVER.idFromName("foo")
      let stub = env.WEBSOCKET_SERVER.get(id)
     
      
    return await stub.fetch(request);
    }
  
  

  
    return env.ASSETS.fetch(request);
  },
};

  export class WebSocketServer extends DurableObject {
    constructor(ctx,env) {
      super(ctx,env)
      this.sessions = new Map()
      this.env = env
  }
    async fetch(request) {
    const url = new URL(request.url);
    console.log("WebSocketServer fetch called, URL:", url.pathname);

    if (url.pathname === "/send" && request.method === "POST") {
  const { socketId, aiResponse } = await request.json();

  for (const [ws, { id }] of this.sessions) {
    if (id === socketId) {
      ws.send(JSON.stringify({ response: aiResponse }));
      console.log("AI response sent to client:", id);
    }
  }

  return new Response("Message sent");
}


     if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
     
     
      const id = crypto.randomUUID();
      server.serializeAttachment({id});
       
      this.sessions.set(server,{id});

      

      server.addEventListener("message", async (event) => {
        const data = JSON.parse(event.data);
        const query = data.payload;
        console.log("Received WS message:", data, "from id:", id);

        console.log(`Received query from ${id}:`, query);
        try {
        await this.env.Book_Recommender.run({
          query,
          socketId: id,
          stub: this,
        });
      
      
        }
      catch (err) {
        server.send(JSON.stringify({ error: err.message }));
    }
    });

      server.addEventListener("close", () => {
  this.sessions.delete(server);
});

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }
  }
  }
  

  



  


export {BookRecommenderWorkflow} from "./workflow.js";
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    
    if (url.pathname === "/ws") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected websocket", { status: 426 });
      }

      const pair = new WebSocketPair();
      const [client, server] = [pair[0], pair[1]];
      server.accept();
      server.addEventListener("message", async (event) => {
        const query = event.data

        await env.Book_Recommender.run({
          query, 
          socketId: "user-1",
        });
      });

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    

  
    return env.ASSETS.fetch(request);
  },
};


  



  

import { WorkflowEntrypoint } from "cloudflare:workers";

export class BookRecommenderWorkflow extends WorkflowEntrypoint {
  async run(event, step) {
    try {
      // Params are passed via event.payload per Workflows API
      const { query, socketId } = event?.payload ?? {};
      console.log("Workflow received query:", query, "socketId:", socketId);

      const aiCall = await step.do("ai-response", async () => {
        const prompt = {
          messages: [
            {
              role: "system",
              content:
                "You are a book recommendation system. When asked, create a list of 5 books relevant to the user's query. make sure the book title is written by the author. rank the books by how much they fit the user's query. the books must be the actual title and not the series name. do not repeat any authors or books from the same series. format as a json object with title and author only. number each title and author key ex:title_1 author_1. do not include any additional text or formatting. do not include any prefixes such as 'Here are some book recommendations:'. respond with only the json object."
            },
            { role: "user", content: query }
          ],
          max_tokens: 768,
        };
        const aiResponse = await this.env.AI.run("@cf/meta/llama-4-scout-17b-16e-instruct", prompt);
        console.log("AI Response before:", aiResponse);
        return JSON.stringify(aiResponse.response)
      });
      
      const apiQuery = await step.do("construct-api-query", async () => {
        console.log("AI Call Result:", aiCall);
        const aiCallParsed = JSON.parse(aiCall);

        const title = aiCallParsed.title_1;
        const author = aiCallParsed.author_1;
        const title_data = title.toLowerCase().replace(/ /g, '+');
        const author_data = author.toLowerCase().replace(/ /g, '+');
        const Query = 'https://www.googleapis.com/books/v1/volumes?q=intitle:' + title_data + '+inauthor:' + author_data + '&key=' + this.env.GBOOKS_API_KEY;
        console.log("Constructed Google Books API query:", Query);
        return new Response(Query)
      });
      /*const apiCall = await step.do("create api call", async () => {
      
        const prompt = {
          messages: [
            {
              role: "system",
              content:
                "You are an API query generator. Given book preferences, return ONLY a concise Google Books search query (no quotes, no prefixes)."
            },
            {
              role: "user",
              content: JSON.stringify(aiResponse)
            }
          ],
          max_tokens: 64,
        };
        return await this.env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", prompt);
      });
*/
    await step.do("send-response", async () => {
        // Get the Durable Object instance via this.env
        const id = this.env.WEBSOCKET_SERVER.idFromName("websocket");
        const wsServer = this.env.WEBSOCKET_SERVER.get(id);
        console.log("Sending response to socketId:", socketId, "aiCall:", aiCall);
        // Send the response through the WebSocket server
  // Durable Object stub.fetch requires an absolute URL; hostname is ignored
  await wsServer.fetch("https://do/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ socketId, aiCall })
        });
      });
    } catch (error) {
      console.error("Workflow error:", error);
    }
  }
}
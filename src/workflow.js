import { WorkflowEntrypoint } from "cloudflare:workers";

export class BookRecommenderWorkflow extends WorkflowEntrypoint {
  async run(event, step) {
    try {
      // Params are passed via event.payload per Workflows API
      const { query, socketId } = event?.payload ?? {};
      console.log("Workflow received query:", query, "socketId:", socketId);

      const aiResponse = await step.do("ai-response", async () => {
        const prompt = {
          messages: [
            { role: "system", content: "You are a book recommendation system." },
            { role: "user", content: query || "Recommend a good book." },
          ],
          max_tokens: 1024,
        };
        // Access bindings via this.env inside workflows
        return this.env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", prompt);
      });

      await step.do("send-response", async () => {
        // Get the Durable Object instance via this.env
        const id = this.env.WEBSOCKET_SERVER.idFromName("websocket");
        const wsServer = this.env.WEBSOCKET_SERVER.get(id);

        // Send the response through the WebSocket server
  // Durable Object stub.fetch requires an absolute URL; hostname is ignored
  await wsServer.fetch("https://do/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            socketId,
            aiResponse: aiResponse.response || aiResponse.output_text || aiResponse,
          }),
        });
      });
    } catch (error) {
      console.error("Workflow error:", error);
    }
  }
}
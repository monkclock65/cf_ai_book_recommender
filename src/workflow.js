import { WorkflowEntrypoint } from "cloudflare:workers";
export {WebSocketServer} from "./worker.js";
export class BookRecommenderWorkflow extends WorkflowEntrypoint {
  async run(event,WorkflowStep,env) {
  console.log("Workflow started with event:", event);
  const {query,socketId} = event
    console.log("Workflow received query:", query, "socketId:", socketId);
  const aiResponse = await WorkflowStep.run("ai-response", async () => {
    const prompt = {
    messages: [
      { role: "system", content: "You are a book recommendation system." },
      { role: "user", content: query || "Recommend a good book." },
    ],
    max_tokens: 1024,
  };
  console.log(query);
  return env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", prompt);

  });

          await WorkflowStep.run("Send response", async () => {
      const id = env.WEBSOCKET_SERVER.idFromName("foo");
      const stub = env.WEBSOCKET_SERVER.get(id);
      await event.stub.fetch("/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          socketId,
          aiResponse: aiResponse.output_text || aiResponse,
        }),
      });
    });
  
}
}
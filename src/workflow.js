import { WorkflowEntrypoint } from "cloudflare:workers";

export class BookRecommenderWorkflow extends WorkflowEntrypoint {
  async run(event,WorkflowStep) {
    const {query, socketId} = event;

  const aiResponse = await this.step.do("ai-response", async => {
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

  await this.step.do("send response to client", async => {
          const socket = env.WEBSOCKETS.get(socketId);
      if (socket) {
          socket.send(JSON.stringify(aiResponse));
          console.log("ai response sent")
      }
  });
}
}
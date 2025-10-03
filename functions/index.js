
export default {
  async fetch(request, env) {
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
   async handleRequest(request) {
        const upgradeHeader = request.headers.get('Upgrade');
        if (!upgradeHeader || upgradeHeader !== 'websocket') {
        return new Response('Expected Upgrade: websocket', { status: 426 });
          }
                
        const webSocketPair = new webSocketPair();
        const client = webSocketPair[0];
        const server = webSocketPair[1];

        return new Response(null, {
            status: 101,
            websocket: client,
             });
        }

  
      

    }

export async function onRequest({ request, env }) {
  // Forward the request to your worker
  const workerUrl = "https://cf-ai-book-recommender.workers.dev";
  return fetch(new Request(workerUrl, request));
}

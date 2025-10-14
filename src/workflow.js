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
                "You are a book recommendation system. When asked, create a list of 5 books relevant to the user's query. make sure the book title is written by the author. rank the books by how much they fit the user's query. the books must be the actual title and not the series name. do not include things like The Kingkillers Chronicle:The name of the wind. do only the main title: the name of the wind. do not repeat any authors or books from the same series. format as a json object with title and author only do not include any additional text or formatting or ''' marks. put the title and author as objects in an array, with each pair being one object with title and author as keys. call the array bookRecommendations. respond with only the json object."
            },
            { role: "user", content: query }
          ],
          max_tokens: 1024,
        };
        const aiResponse = await this.env.AI.run("@cf/meta/llama-4-scout-17b-16e-instruct", prompt);
        console.log("AI Response before:", aiResponse);
        return aiResponse.response
      });
      const validAI = await step.do("validate-ai-responese", async () => {
        const prompt = {
          messages: [
            {
              role: "system",
              content: "You are a search query validator. Given a list of book recommendations in json format, ensure that the titles and authors are correctly formatted and valid. Respond with the corrected json object or the original if no changes are needed. Do not include any additional text or formatting. example of invalid formatting: title with author name included, title with series name included, author name misspelled. example of valid formatting: title with only the book title, author with only the author's name. ensure there are no duplicate authors or titles. ensure the json is properly formatted."
            },
            { role: "user", content: JSON.stringify(aiCall) }
          ],
          max_tokens: 1024,
          
        }
        const aiResponseValid = await this.env.AI.run("@cf/meta/llama-4-scout-17b-16e-instruct", prompt);
        console.log("AI Response after validation:", JSON.stringify(aiResponseValid.response));
        return aiResponseValid.response;


      })
      const apiQuery = await step.do("construct-api-query", async () => {
        console.log("AI Call Result:", validAI);
        const QueryArray = [];
  ;
        for (let i = 0; i < validAI.bookRecommendations.length; i++) {
          const title = validAI.bookRecommendations[i].title;
          const author = validAI.bookRecommendations[i].author;
          const title_data = title.toLowerCase();
          const author_data = author.toLowerCase();
          const Query = `https://www.googleapis.com/books/v1/volumes?q=intitle:%22${title_data}%22+inauthor:%22${author_data}%22&maxResults=1&printType=books&key=${this.env.GBOOKS_API_KEY}`;
        console.log("Constructed Google Books API query:", Query)
        QueryArray.push(Query);
        }
        return QueryArray;
      });

     const apiData = await step.do("get-api-query", async () => {
        const apidataArray = [];
        for (let i = 0; i < apiQuery.length; i++) {
        const response = await fetch(apiQuery[i])
          if (!response.ok) {
            console.error("Google Books API error:", response.statusText);
          }
          const data = await response.text();
          console.log("Google Books API data:", data);
          apidataArray.push(JSON.parse(data));
        }
        return apidataArray;
      });

      await step.do("parse-api-response", async () => {
        const apiDataParsed = apiData
        const bookRecArray = [];
        for (let i = 0; i < apiDataParsed.length; i++) {
        if (apiDataParsed[i].totalItems > 0) {
          const book = apiDataParsed[i].items[0].volumeInfo;
          const title = book.title;
          const author = book.authors[0];
        let imagelink = book.imageLinks?.thumbnail || "";
          if (imagelink && imagelink.startsWith("http:")) {
            imagelink = imagelink.replace("http:", "https:");
          }          
  const infoLink = book.previewLink || book.canonicalVolumeLink || book.infoLink || "";

          const bookrec = { title, author, imagelink, infoLink };
          bookRecArray.push(bookrec);
          
        }
      }
        console.log("Book Recommendations Array:", bookRecArray);
        
      })
      
        

      


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
        console.log("Sending response to socketId:", socketId, "validAI:", validAI);
        // Send the response through the WebSocket server
  // Durable Object stub.fetch requires an absolute URL; hostname is ignored
  await wsServer.fetch("https://do/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ socketId, validAI })
        });
      });
    } catch (error) {
      console.error("Workflow error:", error);
    }
  }
}
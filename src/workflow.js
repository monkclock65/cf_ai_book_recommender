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
        console.log("AI Response before:", JSON.stringify(aiResponse));
        return aiResponse.response
      });
      const validAI = await step.do("validate-ai-responese", async () => {
        const prompt = {
          messages: [
            {
              role: "system",
              content: "You are a search query validator. Given a list of book recommendations in json format, ensure that the titles and authors are correctly formatted and valid. Respond with the corrected json object or the original if no changes are needed. Do not include any additional text or formatting. example of invalid formatting: title with author name included, title with series name included, author name misspelled. example of valid formatting: title with only the book title, author with only the author's name. ensure there are no duplicate authors or titles. in the case of biographies, the name of the subject is allowed in the title. make sure the author is the person who wrote the book. if it is not, change the author field to blank. ensure the json is properly formatted."
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
          const Query = `https://www.googleapis.com/books/v1/volumes?q=intitle:%22${title_data}%22+&maxResults=10&printType=books&key=${this.env.GBOOKS_API_KEY}`;
        console.log("Constructed Google Books API query:", Query)
        QueryArray.push(Query);
        }
        return QueryArray;
      });

  const apiData = await step.do("get-api-query", async () => {
        const apidataArray = [];
        for (let i = 0; i < apiQuery.length; i++) {
          const primaryUrl = apiQuery[i];
          const res = await fetch(primaryUrl);
          const text = await res.text();
          if (!res.ok) {
            console.error("Google Books API error:", res.statusText, text);
          }
        
          apidataArray.push(JSON.parse(text));
          
        }
        return apidataArray;
      });

      let hadUnmatched = false;
      const apiOutput = await step.do("parse-api-response", async () => {
        const apiDataParsed = apiData
        const bookRecArray = [];
        for (let i = 0; i < apiDataParsed.length; i++) {
        if (apiDataParsed[i].totalItems > 0) {
          const items = Array.isArray(apiDataParsed[i].items) ? apiDataParsed[i].items : [];
          const targetTitle = (validAI?.bookRecommendations?.[i]?.title || "").toLowerCase().trim();

          const hasImage = (it) => !!(it?.volumeInfo?.imageLinks?.thumbnail || it?.volumeInfo?.imageLinks?.smallThumbnail);
          const normTitle = (it) => (it?.volumeInfo?.title || "").toLowerCase().trim();

          const exactMatches = items.filter(it => normTitle(it) === targetTitle);
          let picked = exactMatches.find(hasImage)
                    || exactMatches[0]
                    || items.find(hasImage)
                    || items[0]
                    || null;

          if (!picked) {
            // No usable item despite totalItems > 0; skip but don't crash
            console.log('no suitable item found in results for:', validAI?.bookRecommendations?.[i]?.title);
            continue;
          }

          const book = picked.volumeInfo || {};
          const title = book.title ?? "";
          const author = Array.isArray(book.authors) ? (book.authors[0] || "") : (book.authors || "");

          let imagelink = book.imageLinks?.thumbnail || book.imageLinks?.smallThumbnail || "";
          if (imagelink && imagelink.startsWith("http:")) {
            imagelink = imagelink.replace("http:", "https:");
          }
          let infoLink = book.previewLink || book.canonicalVolumeLink || book.infoLink || "";
          if (infoLink && infoLink.startsWith("http:")) {
            infoLink = infoLink.replace("http:", "https:");
          }

          const bookrec = { title, author, imagelink, infoLink };
          bookRecArray.push(bookrec);
        } else {
          // Truly no results; flag unmatched to inform client
          const missing = validAI?.bookRecommendations?.[i];
          const title = missing?.title || "";
          hadUnmatched = true;
          console.log('no results from Google Books, skipping:', title);
          console.log('apiDataParsed', JSON.stringify(apiData));
        }
      }
        console.log("Book Recommendations Array:", bookRecArray);
        return bookRecArray;

      })



      const aiDescription = await step.do("create-ai-description", async () => {

        const prompt = {
          messages: [
            {
              role: "system",
              content:
                "you are a book description generator. given a user query and  a list of book recommendations, generate a very brief 1 to 2 sentence description for each book related to the query, formatted as JSON objects in an array with the name descarray:. do  not add any additional text or formatting. key/values: title: BOOK_TITLE desc: BOOK_DESCRIPTION"
            },
            {
              role: "user",
              content: `${query} ${JSON.stringify(validAI)}`
            }
          ],
          max_tokens: 1024,
        };
        const descAI = await this.env.AI.run("@cf/meta/llama-4-scout-17b-16e-instruct", prompt);
        console.log("AI Description Response:", descAI);
        return JSON.stringify(descAI.response);
      });

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
      body: JSON.stringify({ socketId, apiOutput, aiDescription, ...(hadUnmatched ? { error: "Error: ai tried to recommend a book that doesn't exist" } : {}) })
        });
      });
    } catch (error) {
      console.error("Workflow error:", error);
    }
  }
}
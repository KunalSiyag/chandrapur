import OpenAI from "openai";

console.log("1. Starting GMI test...");

const apiKey = process.env.GMI_API_KEY;

if (!apiKey) {
  console.error("❌ GMI_API_KEY is not set.");
  console.error("Run:");
  console.error('export GMI_API_KEY="YOUR_KEY"');
  process.exit(1);
}

console.log("2. API key found.");

const client = new OpenAI({
  apiKey,
  baseURL: "https://api.gmi-serving.com/v1",
});

console.log("3. Sending request to GMI...");

try {
  const response = await client.chat.completions.create({
    model: "zai-org/GLM-5.3-Flash",
    messages: [
      {
        role: "user",
        content: "Reply with exactly: GMI WORKS"
      }
    ],
    temperature: 0,
    max_tokens: 20,
  });

  console.log("4. Response received:");
  console.log(response.choices?.[0]?.message?.content);
  console.log("✅ GMI test successful.");
} catch (error) {
  console.error("❌ GMI request failed.");
  console.error(error);
}

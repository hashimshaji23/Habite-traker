import "dotenv/config";
import Groq from "groq-sdk";

const key = process.env.GROQ_API_KEY;
const model = process.env.GROQ_MODEL;
const client = new Groq({ apiKey: key });

console.log("Testing model:", model);

try {
  const res = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: "You are a helpful habit coach assistant." },
      { role: "user", content: "Give me a motivational sentence about building habits." },
    ],
    temperature: 0.7,
  });
  console.log("SUCCESS!");
  console.log("Response:", res.choices[0]?.message?.content);
} catch (err) {
  console.error("FAILED:", err.message);
}

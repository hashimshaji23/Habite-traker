import "dotenv/config";
import Groq from "groq-sdk";

let client = null;
const getClient = () => {
    if (client) return client;
    const key = process.env.GROQ_API_KEY;
    if (!key) return null;
    client = new Groq({ apiKey: key });
    return client;
};

export const getModel = () => process.env.GROQ_MODEL || "qwen/qwen3.8-27b";
export const isAIEnabled = () => !!process.env.GROQ_API_KEY;

export const parseJSON = (text) => {
    if (!text) return null;
    let cleaned = String(text).trim();

    // 1. Try stripping markdown code fences
    cleaned = cleaned
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

    // 2. Direct JSON parse
    try {
        return JSON.parse(cleaned);
    } catch {
        // 3. Fallback: extract the outermost {...} or [...]
        const jsonMatch = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[0]);
            } catch {
                return null;
            }
        }
        return null;
    }
};

export const chatCompletion = async ({
    system,
    user,
    temperature = 0.7,
}) => {
    const c = getClient();

    if (!c) {
        return {
            ok: false,
            content:
                "AI features are disabled - set GROQ_API_KEY in the backend .env to enable real AI responses.",
        };
    }

    const primaryModel = getModel();
    // Fallback models if primary is unavailable
    const candidateModels = Array.from(
        new Set([primaryModel, "qwen/qwen3.8-27b", "openai/gpt-oss-20b", "openai/gpt-oss-120b"])
    );

    let lastError = null;
    for (const modelName of candidateModels) {
        try {
            const res = await c.chat.completions.create({
                model: modelName,
                messages: [
                    { role: "system", content: system },
                    { role: "user",   content: user },
                ],
                temperature,
            });

            return {
                ok: true,
                content: (res.choices[0]?.message?.content || "").trim(),
            };
        } catch (err) {
            lastError = err;
            console.warn(`AI model ${modelName} encountered error: ${err.message}. Trying next fallback...`);
        }
    }

    console.error("All AI candidate models failed. Last error:", lastError?.message);
    return {
        ok: false,
        content: "AI request failed. Please try again later.",
    };
};

export const SYSTEM_PROMPTS = {
    weekly:
        "You are an encouraging, supportive habit coach. Analyse the user's last 7 days of habit data and write a short personalised weekly report in clean Markdown. Include a headline, a summary of their consistency and progress, key strengths/wins with bullet points, and 1 or 2 positive, actionable suggestions for next week. Keep the tone warm, practical, and uplifting. Return only the Markdown content without JSON wrappers.",


    suggestion:
        "You are an expert habit coach. Based on the user's goals, productive time, and past struggles, suggest exactly 3 practical and personalised habit improvements. Return ONLY valid JSON matching this schema: {\"suggestions\": [{\"name\": string, \"description\": string, \"frequency\": \"daily\"|\"weekly\", \"category\": string, \"icon\": string, \"reason\": string}]}. Do not include markdown codeblocks or extra text outside the JSON.",

    recovery:
        "You are a compassionate habit recovery coach. The user broke a streak. Write a personalised 3-day recovery plan based on their habit data. The plan should help them restart without feeling overwhelmed. Give one simple action for each of the next 3 days. Be supportive and avoid guilt or judgment. Return only the 3-day plan.",

    chat:
        "You are a helpful habit analysis assistant. Answer the user's question using ONLY the provided habit data as context. Do not invent information or make assumptions about the user. Give clear, concise, and practical answers. If the provided data does not contain enough information to answer the question, say that there is not enough data. Do not provide medical or professional advice.",

    morning:
        "You are a warm, motivating friend. Write a single short morning message of 30-60 words using the user's actual habit data, goals, and recent progress. Make the message personal, encouraging, and realistic. Mention their progress or today's focus when appropriate. Do not use guilt, pressure, or overly dramatic language. Return only the morning message."
};
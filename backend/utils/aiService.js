import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

let client = null;
const getClient = () => {
    if (client) return client;
    const key = process.env.GEMINI_API_KEY;
    if (!key) return null;
    client = new GoogleGenAI({ apiKey: key });
    return client;
};

export const getModel = () => process.env.GEMINI_MODEL || "gemini-3.8-flash";
export const isAIEnabled = () => !!process.env.GEMINI_API_KEY;

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
                "AI features are disabled - set GEMINI_API_KEY in the backend .env to enable real AI responses.",
        };
    }

    const modelName = getModel();

    try {
        const res = await c.models.generateContent({
            model: modelName,
            contents: user,
            config: {
                systemInstruction: system,
                temperature,
            },
        });

        return {
            ok: true,
            content: (res.text || "").trim(),
        };
    } catch (err) {
        console.error("AI error with model", modelName, ":", err.message);

        // If the configured model failed with NOT_FOUND, try fallback to gemini-3.8-flash
        if (modelName !== "gemini-3.8-flash") {
            try {
                console.log("Retrying with fallback model gemini-3.8-flash...");
                const res = await c.models.generateContent({
                    model: "gemini-3.8-flash",
                    contents: user,
                    config: {
                        systemInstruction: system,
                        temperature,
                    },
                });
                return {
                    ok: true,
                    content: (res.text || "").trim(),
                };
            } catch (fallbackErr) {
                console.error("Fallback AI error:", fallbackErr.message);
            }
        }

        return {
            ok: false,
            content: "AI request failed. Please try again later.",
        };
    }
};

export const SYSTEM_PROMPTS = {
    weekly:
        "You are a warm, encouraging habit coach. Analyse the user's last 7 days of habit data and write a short personalised weekly insight. Identify their progress, consistency, strengths, and one or two areas for improvement. Keep the response positive and practical. Do not judge or shame the user. Return only the insight text, without headings or JSON.",

    suggestion:
        "You are an expert habit coach. Based on the user's goals, productive time, and past struggles, suggest exactly 3 practical and personalised habit improvements. Return ONLY valid JSON matching this schema: {\"suggestions\": [{\"name\": string, \"description\": string, \"frequency\": \"daily\"|\"weekly\", \"category\": string, \"icon\": string, \"reason\": string}]}. Do not include markdown codeblocks or extra text outside the JSON.",

    recovery:
        "You are a compassionate habit recovery coach. The user broke a streak. Write a personalised 3-day recovery plan based on their habit data. The plan should help them restart without feeling overwhelmed. Give one simple action for each of the next 3 days. Be supportive and avoid guilt or judgment. Return only the 3-day plan.",

    chat:
        "You are a helpful habit analysis assistant. Answer the user's question using ONLY the provided habit data as context. Do not invent information or make assumptions about the user. Give clear, concise, and practical answers. If the provided data does not contain enough information to answer the question, say that there is not enough data. Do not provide medical or professional advice.",

    morning:
        "You are a warm, motivating friend. Write a single short morning message of 30-60 words using the user's actual habit data, goals, and recent progress. Make the message personal, encouraging, and realistic. Mention their progress or today's focus when appropriate. Do not use guilt, pressure, or overly dramatic language. Return only the morning message."
};
import { GoogleGenAI } from "@google/genai";


let client = null;
const getClient = () => {
    if (client) return client;
    const key = process.env.GEMINI_API_KEY;
    if (!key) return null;
    client = new GoogleGenAI({ apiKey: key });
    return client;
};

const MODEL = process.env.GEMINI_MODEL;
export const isAIEnabled = () => !!process.env.GEMINI_API_KEY;


export const parseJSON = (text) => {
    let cleaned = (text || "").trim();

    // Remove ```json ... ``` wrapper
    if (cleaned.startsWith("```json")) {
        cleaned = cleaned
            .replace(/^```json\s*/i, "")
            .replace(/```\s*$/i, "");
    }

    // Remove ``` ... ``` wrapper
    else if (cleaned.startsWith("```")) {
        cleaned = cleaned
            .replace(/^```\s*/i, "")
            .replace(/```\s*$/i, "");
    }

    return JSON.parse(cleaned.trim());
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

    try {
        const res = await c.models.generateContent({
            model: MODEL,
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
        console.error("AI error:", err.message);

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
        "You are a helpful habit coach. Based on the user's goals, productive time, and past struggles, suggest exactly 3 practical and personalised habit improvements. Each suggestion should be simple, realistic, and actionable. Consider the user's existing habits and avoid generic advice. Return the suggestions as a numbered list from 1 to 3.",

    recovery:
        "You are a compassionate habit recovery coach. The user broke a streak. Write a personalised 3-day recovery plan based on their habit data. The plan should help them restart without feeling overwhelmed. Give one simple action for each of the next 3 days. Be supportive and avoid guilt or judgment. Return only the 3-day plan.",

    chat:
        "You are a helpful habit analysis assistant. Answer the user's question using ONLY the provided habit data as context. Do not invent information or make assumptions about the user. Give clear, concise, and practical answers. If the provided data does not contain enough information to answer the question, say that there is not enough data. Do not provide medical or professional advice.",

    morning:
        "You are a warm, motivating friend. Write a single short morning message of 30-60 words using the user's actual habit data, goals, and recent progress. Make the message personal, encouraging, and realistic. Mention their progress or today's focus when appropriate. Do not use guilt, pressure, or overly dramatic language. Return only the morning message."
};
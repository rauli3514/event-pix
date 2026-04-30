
import { OpenAI } from "openai";
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.VITE_OPENAI_API_KEY;

if (!apiKey) {
    console.error("No API key found in .env");
    process.exit(1);
}

console.log("Testing OpenAI Key:", apiKey.substring(0, 10) + "...");

const client = new OpenAI({ apiKey });

async function test() {
    try {
        const completion = await client.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: "Say hello" }],
        });
        console.log("Success:", completion.choices[0].message.content);
    } catch (error) {
        console.error("Error calling OpenAI:", error);
    }
}

test();


import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";

dotenv.config();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

if (!process.env.GROQ_API_KEY) {
    console.error("GROQ_API_KEY is missing from .env");
    process.exit(1);
}

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

app.post("/api/chat", async (req, res) => {
    try {
        const {
            concept,
            originalQuestion,
            sourceMessage,
            conversation
        } = req.body;

        if (!concept || !Array.isArray(conversation)) {
            return res.status(400).json({
                error: "Missing concept or conversation."
            });
        }

        const messages = [
            {
                role: "system",
                content: `
You are Subchat, an AI assistant inside a contextual side conversation.

Your purpose is to help users explore a selected concept without
derailing their original conversation.

SELECTED CONCEPT:
${concept}

ORIGINAL USER QUESTION:
${originalQuestion || "Not provided"}

ORIGINAL AI RESPONSE:
${sourceMessage || "Not provided"}

BEHAVIOUR:
- Explain concepts clearly and accurately.
- Use simple examples when they help understanding.
- Adapt to the user's follow-up questions.
- Stay focused on the selected concept.
- Preserve the context of this side conversation.
- Do not claim you can modify the main conversation.

FORMATTING REQUIREMENTS:
- Use standard Markdown formatting.
- Use ## or ### for headings.
- Use **text** for bold and *text* for italics.
- Use normal numbered and bulleted lists.
- Use standard Markdown tables when useful.
- Use $...$ for inline mathematical equations.
- Use $$...$$ for display mathematical equations.
- Do not escape Markdown characters unnecessarily.
- Do not put the entire response inside a code block.
- Keep paragraphs readable and avoid unnecessary complexity.
- Use a concise summary when it would help the user.
`
            },
            ...conversation
                .filter(
                    (message) =>
                        (message.role === "user" ||
                            message.role === "assistant") &&
                        typeof message.content === "string"
                )
                .map((message) => ({
                    role: message.role,
                    content: message.content
                }))
        ];

        const completion = await groq.chat.completions.create({
            model: "openai/gpt-oss-120b",
            messages,
            temperature: 0.6
        });

        const reply =
            completion.choices[0]?.message?.content;

        if (!reply) {
            throw new Error("Groq returned an empty response.");
        }

        res.json({ reply });
    } catch (error) {
        console.error("Groq API error:", error.message);

        res.status(500).json({
            error: "Failed to generate a response from Groq.",
            details: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(
        `Subchat server running on http://localhost:${PORT}`
    );
});

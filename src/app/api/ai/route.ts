import { NextResponse } from "next/server";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { auth } from "@/lib/auth";
import { aiRequestSchema } from "@/lib/validations";

const groq = createOpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ_API_KEY,
});

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function getModel() {
  const provider = process.env.AI_PROVIDER ?? "groq";
  if (provider === "openai" && process.env.OPENAI_API_KEY) {
    return openai("gpt-4o-mini");
  }
  if (process.env.GROQ_API_KEY) {
    return groq("llama-3.3-70b-versatile");
  }
  return null;
}

const PROMPTS: Record<string, (content: string, context?: string) => string> = {
  summarize: (content) =>
    `Summarize the following document content concisely in 2-3 paragraphs:\n\n${content}`,
  improve: (content) =>
    `Improve the writing quality of the following text. Return only the improved version:\n\n${content}`,
  generate: (content) =>
    `Generate well-structured document content based on this prompt:\n\n${content}`,
  grammar: (content) =>
    `Fix grammar, spelling, and punctuation. Return only the corrected text:\n\n${content}`,
  "explain-diff": (content, context) =>
    `Explain the differences between these two document versions in plain language:\n\nVersion A:\n${context ?? ""}\n\nVersion B:\n${content}`,
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const model = getModel();
  if (!model) {
    return NextResponse.json(
      { error: "AI not configured. Set GROQ_API_KEY or OPENAI_API_KEY." },
      { status: 503 },
    );
  }

  const body = await request.json();
  const parsed = aiRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const promptFn = PROMPTS[parsed.data.action];
  const prompt = promptFn(parsed.data.content, parsed.data.context);

  try {
    const { text } = await generateText({ model, prompt });
    return NextResponse.json({ result: text });
  } catch (err) {
    console.error("AI error:", err);
    return NextResponse.json({ error: "AI request failed" }, { status: 500 });
  }
}

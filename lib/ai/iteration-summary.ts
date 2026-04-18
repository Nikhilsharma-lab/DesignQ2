import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

const iterationSummarySchema = z.object({
  overview: z
    .string()
    .describe(
      "A 2-3 sentence stakeholder-friendly overview of the exploration so far. Neutral tone — describe what directions exist, not which is best.",
    ),
  directions: z
    .array(
      z.object({
        title: z.string().describe("The iteration title"),
        summary: z
          .string()
          .describe(
            "1-2 sentence neutral description of this direction's approach and key tradeoffs",
          ),
      }),
    )
    .describe("One entry per iteration, summarizing each direction neutrally"),
  openQuestions: z
    .array(z.string())
    .describe(
      "2-4 questions the team should consider when reviewing these directions",
    ),
});

export type IterationSummaryResult = z.infer<typeof iterationSummarySchema>;

export async function generateIterationSummary(input: {
  requestTitle: string;
  requestDescription: string;
  designFrame?: string | null;
  iterations: Array<{
    title: string;
    description: string | null;
    rationale: string | null;
    figmaUrl: string | null;
  }>;
}): Promise<IterationSummaryResult> {
  const iterationText = input.iterations
    .map(
      (it, i) =>
        `Direction ${i + 1}: "${it.title}"${it.description ? `\nDescription: ${it.description}` : ""}${it.rationale ? `\nRationale: ${it.rationale}` : ""}${it.figmaUrl ? `\nFigma: ${it.figmaUrl}` : ""}`,
    )
    .join("\n\n");

  const { object } = await generateObject({
    model: anthropic("claude-haiku-4-5-20251001"),
    schema: iterationSummarySchema,
    prompt: `You are summarizing design exploration directions for stakeholders.

REQUEST: "${input.requestTitle}"
${input.requestDescription ? `PROBLEM: ${input.requestDescription}` : ""}
${input.designFrame ? `DESIGN FRAME: ${input.designFrame}` : ""}

DIRECTIONS EXPLORED:
${iterationText}

Generate a stakeholder-friendly summary. Rules:
- Be NEUTRAL. Describe each direction factually. Do NOT rank, rate, or recommend.
- Highlight tradeoffs and approaches, not quality judgments.
- The overview should help someone who hasn't seen these directions understand what was explored.
- Open questions should prompt productive discussion, not lead toward a specific direction.`,
  });

  return object;
}

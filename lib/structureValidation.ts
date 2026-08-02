import { runWorkersAI, extractText } from "./workersAI";

const MOONDREAM_MODEL = "@cf/moondream/moondream3.1-9B-A2B";

export interface StructuralFacts {
  isOutdoor: boolean;
  hasRoofOrCeiling: boolean;
  windowCount: number;
  doorCount: number;
}

export async function describeStructure(
  imageUrl: string
): Promise<StructuralFacts> {
  const prompt = `Look at this photo of a space. Respond with ONLY a JSON
object, no other text, in exactly this shape:
{"isOutdoor": boolean, "hasRoofOrCeiling": boolean, "windowCount": number, "doorCount": number}
"isOutdoor" is true if this is an exterior/outdoor space (patio, yard,
balcony) and false if it's an interior room. "hasRoofOrCeiling" is true if
there is a roof, pergola, awning, or ceiling visible overhead, and false if
it's open sky. Estimate window and door counts as best you can.`;

  const result = await runWorkersAI(MOONDREAM_MODEL, {
    task: "query",
    image: imageUrl,
    question: prompt,
  });

  const raw = extractText(result);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error(
      `Could not parse structural analysis from vision model. Raw response: ${raw.slice(0, 200)}`
    );
  }
  const parsed = JSON.parse(match[0]);
  return {
    isOutdoor: Boolean(parsed.isOutdoor),
    hasRoofOrCeiling: Boolean(parsed.hasRoofOrCeiling),
    windowCount: Number(parsed.windowCount) || 0,
    doorCount: Number(parsed.doorCount) || 0,
  };
}

// Takes already-computed facts for the original (so callers retrying
// generation don't re-analyze the unchanging original image every time —
// that was burning through Neurons for no reason) and only re-analyzes
// the newly generated image.
export async function compareStructure(
  original: StructuralFacts,
  generatedImageUrl: string
): Promise<{ preserved: boolean; reason: string }> {
  const generated = await describeStructure(generatedImageUrl);

  if (original.isOutdoor !== generated.isOutdoor) {
    return {
      preserved: false,
      reason: `The space changed from ${
        original.isOutdoor ? "outdoor" : "indoor"
      } to ${generated.isOutdoor ? "outdoor" : "indoor"}.`,
    };
  }

  if (!original.hasRoofOrCeiling && generated.hasRoofOrCeiling) {
    return {
      preserved: false,
      reason:
        "A roof, pergola, awning, or ceiling was added that wasn't in the original photo.",
    };
  }

  if (original.hasRoofOrCeiling && !generated.hasRoofOrCeiling) {
    return {
      preserved: false,
      reason: "The original roof or ceiling was removed.",
    };
  }

  if (Math.abs(original.windowCount - generated.windowCount) > 1) {
    return {
      preserved: false,
      reason: `Window count changed noticeably (was ~${original.windowCount}, now ~${generated.windowCount}).`,
    };
  }

  if (Math.abs(original.doorCount - generated.doorCount) > 1) {
    return {
      preserved: false,
      reason: `Door count changed noticeably (was ~${original.doorCount}, now ~${generated.doorCount}).`,
    };
  }

  return { preserved: true, reason: "" };
}
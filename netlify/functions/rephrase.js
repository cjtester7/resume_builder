exports.handler = async function (event) {
  try {
    const { sentence, context } = JSON.parse(event.body);

    if (!sentence) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing sentence" }),
      };
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content: `You are a professional resume and cover letter editor. Rephrase the sentence below in exactly 3 ways for a professional resume or cover letter context.

Return ONLY a JSON object — no markdown, no backticks, no explanation.

The JSON must follow this exact structure:
{
  "stronger": "A more assertive, impact-driven version using strong action verbs and confident language",
  "simpler": "A cleaner, shorter, easier-to-read version that gets straight to the point",
  "natural": "A version that sounds more human and less AI-generated — varied sentence structure, genuine tone"
}

Rules:
- Preserve the core meaning and facts of the original sentence
- Do not invent new achievements or add information not in the original
- Each version must be meaningfully different from the others
- Keep all versions resume/cover letter appropriate
- Each version should be a complete sentence

${context ? "Context (surrounding text for reference): " + context : ""}

Sentence to rephrase:
"${sentence}"`,
          },
        ],
      }),
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const raw = data.content[0].text.trim();
    const parsed = JSON.parse(raw);

    return {
      statusCode: 200,
      body: JSON.stringify({ versions: parsed }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};

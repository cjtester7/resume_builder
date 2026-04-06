exports.handler = async function (event) {
  try {
    const { text } = JSON.parse(event.body);

    if (!text) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing text" }),
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
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: `You are a professional resume editor and thesaurus expert. Analyze the text below sentence by sentence.

For each sentence:
1. Identify all adjectives (including participial adjectives like "proven", "experienced", "rewarding")
2. If the sentence contains MORE than 2 adjectives, skip it entirely — do not include it in the output
3. If the sentence contains 1 or 2 adjectives, for each adjective provide exactly 5 strong synonym alternatives that are contextually appropriate for a professional resume or cover letter. Use thesaurus.com-quality synonyms — varied, precise, and professional.

Return ONLY a JSON array — no markdown, no backticks, no explanation.

Each element in the array must follow this exact structure:
{
  "sentence": "the full original sentence exactly as it appears",
  "adjectives": [
    {
      "word": "the adjective as it appears in the sentence",
      "synonyms": ["syn1", "syn2", "syn3", "syn4", "syn5"]
    }
  ]
}

Important rules:
- Only include sentences that have exactly 1 or 2 adjectives
- Synonyms must match the grammatical form of the original word (e.g. if the word is "rewarding", synonyms should also be adjectives in the same form)
- Synonyms should be meaningfully different from each other
- Keep synonyms professional and resume-appropriate
- The "sentence" field must be the exact original sentence with no changes

---TEXT---
${text}`,
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
      body: JSON.stringify({ sentences: parsed }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};

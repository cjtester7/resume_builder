exports.handler = async function (event) {
  try {
    const { resume, jobDescription, payTarget } = JSON.parse(event.body);

    if (!resume || !jobDescription) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing resume or jobDescription" }),
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
        max_tokens: 1500,
        messages: [
          {
            role: "user",
            content: `You are a candid career coach doing a fit analysis. Analyze the resume against the job description${payTarget ? " and pay target" : ""} and return ONLY a JSON object — no markdown, no preamble, no backticks.

The JSON must follow this exact structure:
{
  "headline": "one short honest sentence summarizing overall fit (e.g. 'Partial fit with notable gaps')",
  "verdict": "strong" | "partial" | "weak",
  "alignment": [
    { "title": "short label", "detail": "one to two sentence explanation" }
  ],
  "gaps": [
    { "title": "short label", "detail": "one to two sentence explanation" }
  ],
  "compensation": "one sentence about how their pay target compares to the role's range, or null if no pay target provided and no salary info in job description",
  "summary": "2-3 sentence honest overall assessment",
  "directions": "2-3 sentence suggestion of better-fit role types or next steps"
}

Keep alignment to 2-4 items. Keep gaps to 2-5 items. Be direct and specific — reference actual details from the resume and job description.

---RESUME---
${resume}

---JOB DESCRIPTION---
${jobDescription}${payTarget ? `\n\n---PAY TARGET---\n${payTarget}` : ""}`,
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
      body: JSON.stringify({ analysis: parsed }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};

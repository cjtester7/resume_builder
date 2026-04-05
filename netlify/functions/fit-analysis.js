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
            content: `You are a candid career coach doing a fit analysis. Analyze the resume against the job description${payTarget ? " and pay target" : ""} and return ONLY a JSON object — no markdown, no preamble, no backticks.\n\nThe JSON must follow this exact structure:\n{\n  "headline": "one short honest sentence summarizing overall fit",\n  "verdict": "strong" | "partial" | "weak",\n  "score": <integer 0-100 representing overall match percentage>,\n  "alignment": [\n    { "title": "short label", "detail": "one to two sentence explanation" }\n  ],\n  "gaps": [\n    { "title": "short label", "detail": "one to two sentence explanation" }\n  ],\n  "compensation": "one sentence about pay comparison, or null if unavailable",\n  "summary": "2-3 sentence honest overall assessment",\n  "directions": "2-3 sentence suggestion of better-fit roles or next steps"\n}\n\nScoring: 80-100 strong fit, 50-79 partial fit, 0-49 weak fit. Keep alignment to 2-4 items, gaps to 2-5 items. Be direct and specific.\n\n---RESUME---\n${resume}\n\n---JOB DESCRIPTION---\n${jobDescription}${payTarget ? "\n\n---PAY TARGET---\n" + payTarget : ""}`,
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

exports.handler = async function (event) {
  try {
    const { jobDescription } = JSON.parse(event.body);

    if (!jobDescription) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing jobDescription" }),
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
        max_tokens: 100,
        messages: [
          {
            role: "user",
            content: `Extract the salary or pay range from this job description. Return ONLY the salary as a short string exactly as it appears, for example: "$80,000 - $100,000" or "$75K/year" or "$45/hour". If no salary information is present, return the word null and nothing else. No explanation, no punctuation, just the value or null.

---JOB DESCRIPTION---
${jobDescription}`,
          },
        ],
      }),
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const raw = data.content[0].text.trim();
    const pay = raw === "null" ? null : raw;

    return {
      statusCode: 200,
      body: JSON.stringify({ pay }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};

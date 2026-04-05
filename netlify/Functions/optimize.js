exports.handler = async function (event) {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  const { resume, jobDescription } = JSON.parse(event.body);

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
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `You are an expert resume writer and career coach.

Given the resume and job description below, rewrite and optimize the resume to:
- Highlight the most relevant experience and skills for this specific role
- Mirror keywords and phrases from the job description (for ATS compatibility)
- Improve clarity, impact, and conciseness
- Use strong action verbs and quantify achievements where possible
- Keep the same overall structure but improve the content

Return only the optimized resume text — no commentary, no preamble.

---RESUME---
${resume}

---JOB DESCRIPTION---
${jobDescription}`,
        },
      ],
    }),
  });

  const data = await response.json();

  if (data.error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: data.error.message }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ result: data.content[0].text }),
  };
};
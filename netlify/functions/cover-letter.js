exports.handler = async function (event) {
  try {
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
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `You are an expert career coach and professional writer. Write a tailored cover letter based on the resume and job description below.

Guidelines:
- 3-4 paragraphs, professional but not stiff
- Opening: express genuine interest in the specific role and company
- Middle: connect 2-3 of the candidate's strongest relevant experiences directly to the job requirements
- Closing: confident call to action
- Do NOT use cliche phrases like "I am writing to express my interest" or "I would be a great fit"
- Sound like a real human wrote it — varied sentence length, natural tone
- Do not include placeholders like [Your Name] or [Date] — just write the body of the letter
- Return only the cover letter text, no commentary

---RESUME---
${resume}

---JOB DESCRIPTION---
${jobDescription}`,
          },
        ],
      }),
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    return {
      statusCode: 200,
      body: JSON.stringify({ result: data.content[0].text }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};

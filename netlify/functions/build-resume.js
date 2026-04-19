exports.handler = async function (event) {
  try {
    const { profile, answers } = JSON.parse(event.body);

    if (!answers) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing answers" }),
      };
    }

    const profileLabels = {
      highschool: "high school student with limited work experience",
      college: "college student with internships and academic projects",
      trades: "trades, service, or hospitality worker (restaurant, retail, construction, etc.)",
      office: "office or corporate professional",
      esl: "foreign-born or ESL candidate — use clear simple language and acknowledge international credentials",
      career: "career changer looking to transition into a new field"
    };

    const profileContext = profileLabels[profile] || "job seeker";

    const answersText = Object.entries(answers)
      .filter(function(entry) { return entry[1] && String(entry[1]).trim(); })
      .map(function(entry) { return entry[0] + ": " + entry[1]; })
      .join("\n");

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
            content: `You are an expert resume writer. Using the information below, write a clean, professional resume for a ${profileContext}.

Guidelines:
- Use standard resume sections: Contact Information, Objective or Summary, Work Experience, Education, Skills
- Only include sections where information was provided — do not invent or fabricate anything
- For work experience, convert their raw task descriptions into strong action-verb bullet points
- Keep language simple and clear — this person may not have strong English writing skills
- If the person has limited experience, emphasize transferable skills, attitude, and willingness to learn
- Format cleanly with section headers in ALL CAPS followed by a line of dashes
- Do not include placeholder text like [Your Name] — use the actual information provided
- Return only the resume text, no commentary

---CANDIDATE INFORMATION---
${answersText}`,
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

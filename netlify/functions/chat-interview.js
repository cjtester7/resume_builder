exports.handler = async function (event) {
  try {
    const { history, systemPrompt } = JSON.parse(event.body);

    if (!history || !systemPrompt) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing history or systemPrompt" }),
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
        system: systemPrompt,
        messages: history,
      }),
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    return {
      statusCode: 200,
      body: JSON.stringify({ reply: data.content[0].text }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};

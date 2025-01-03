(async () => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const issueBody = process.env.ISSUE_BODY || "";
    const issueTitle = process.env.ISSUE_TITLE || "";
    const issueUrl = process.env.ISSUE_URL || "";

    const prompt = `
以下のIssue情報を解析して、バグの簡単な要約、考えられる原因、対策案、緊急度を示してください。

# Issue Title
${issueTitle}
# Issue URL
${issueUrl}
# Issue Body
${issueBody}
`;

    const endpoint = "https://api.openai.com/v1/chat/completions";
    const requestBody = {
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 500,
      temperature: 0.2,
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} - ${await response.text()}`);
    }

    const data = await response.json();
    const aiResult = data?.choices?.[0]?.message?.content || "(No response)";

    console.log(aiResult);

  } catch (error) {
    console.error("Error in triage-ai script:", error);
    process.exit(1);
  }
})();
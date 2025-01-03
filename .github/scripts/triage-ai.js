const { Configuration, OpenAIApi } = require("openai");
const fs = require("fs");

(async () => {
  try {
    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    });
    const openai = new OpenAIApi(configuration);

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

    const response = await openai.createChatCompletion({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: prompt
      }],
      max_tokens: 500,
      temperature: 0.2,
    });

    const aiResult = response.data.choices[0].message.content;

    console.log("AI Triage Result:\n", aiResult);

    fs.writeFileSync("ai_tria_result.txt", aiResult);

    console.log(`::set-output name=commentBody::${aiResult.replace(/\r?\n/g, "%0A")}`);

  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();

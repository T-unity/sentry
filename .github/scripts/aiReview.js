import { Octokit } from "@octokit/rest";

(async () => {
  try {
    const githubToken = process.env.GITHUB_TOKEN;
    const openAiKey = process.env.OPENAI_API_KEY;

    const repoOwner = process.env.GITHUB_REPOSITORY.split("/")[0];
    const repoName = process.env.GITHUB_REPOSITORY.split("/")[1];
    const issueNumber = process.env.ISSUE_NUMBER;

    const octokit = new Octokit({ auth: githubToken });
    const { data: issue } = await octokit.rest.issues.get({
      owner: repoOwner,
      repo: repoName,
      issue_number: issueNumber,
    });

    const issueTitle = issue.title;
    const issueBody = issue.body;

    const guideline = `
あなたはバグ報告のレビューエキスパートです。
以下のテンプレート項目に沿って、Issue が十分に書かれているか評価し、改善点を提案してください。

## バグ報告テンプレート項目
1. 概要 (問題内容)
2. 再現手順
3. 期待される結果
4. 実際の結果
5. 環境情報
6. (任意) スクリーンショット / ログ
7. (任意) 関連情報

## 評価ポイント
- 「何が問題か」が明確か？
- 再現手順が具体的か？
- 期待結果と実際の結果がしっかり区別されているか？
- 環境情報が整っていて、誰でも検証可能そうか？
- スクリーンショットやログが必要そうな場合は提案
- 関連 Issue/PR があるならリンクを促す

## 追加指示
- 必要に応じて、どのように修正・追記すればよいかを具体的にアドバイスしてください。
- セクションごとに 5 点満点で評価し、点数の理由と改善点を出力してください。
- 6,7 に関しては、記述があれば1点、なければ0点としてください。
- 1 - 5 までの各セクションをそれぞれ5点満点で評価し、合計の点数が12点未満であれば再度 issue の内容を見直すよう、コメントをしてください。
`;

    const prompt = `
以下のIssueを読み、上記のガイドラインを踏まえたレビューを行ってください。
Issueタイトル: ${issueTitle}
Issue本文:
${issueBody}
`;

    const endpoint = "https://api.openai.com/v1/chat/completions";
    const requestBody = {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: guideline },
        { role: "user", content: prompt },
      ],
      temperature: 0.0,
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();
    const reviewMessage = data?.choices?.[0]?.message?.content ?? "";

    await octokit.rest.issues.createComment({
      owner: repoOwner,
      repo: repoName,
      issue_number: issueNumber,
      body: `## AI レビュー結果\n\n${reviewMessage}`,
    });

    console.log("AI Review completed and commented successfully.");
  } catch (error) {
    console.error("Error while reviewing issue:", error);
    process.exit(1);
  }
})();

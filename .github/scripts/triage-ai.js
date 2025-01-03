(async () => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const issueBody = process.env.ISSUE_BODY || "";
    const issueTitle = process.env.ISSUE_TITLE || "";
    const issueUrl = process.env.ISSUE_URL || "";
    const ghToken = process.env.GITHUB_TOKEN;
    
    // 1. スタックトレース情報をIssue本文から抽出 (簡単な正規表現例)
    //    例: "| `main.go` | `main` | `25` |" の行を探す
    const stackLines = issueBody.match(/\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|\s*`(\d+)`\s*\|/g) || [];
    let codeSnippets = "";
    
    for (const line of stackLines) {
      // line 例: "| `main.go` | `main` | `25` |"
      const match = line.match(/\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|\s*`(\d+)`\s*\|/);
      if (!match) continue;
      const filename = match[1]; // main.go
      const lineno = parseInt(match[3]); // 25

      // 2. GitHub API でこのファイルを取得
      //    例: GET /repos/{owner}/{repo}/contents/{filename}?ref=main
      const snippet = await fetchCodeSnippetFromGitHub(
        ghToken,
        "T-unity",  // リポジトリオーナー
        "sentry",   // リポジトリ名
        filename,
        "main",     // ブランチ名
        lineno,
        5          // 前後5行取得 (任意)
      );

      codeSnippets += `### Code snippet: ${filename} (around line ${lineno})\n`;
      codeSnippets += "```go\n";  // 言語は任意
      codeSnippets += snippet;
      codeSnippets += "\n```\n\n";
    }

    // 3. AIへ投げるプロンプトを組み立てる
    let prompt = `
以下のIssue情報を解析して、バグの簡単な要約、考えられる原因、対策案、緊急度を示してください。

# Issue Title
${issueTitle}
# Issue URL
${issueUrl}
# Issue Body
${issueBody}

# Additional code context
${codeSnippets}
`;

    // 4. OpenAI APIへリクエスト
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

    // 5. コンソール出力 (→ GitHub ActionsがこれをCommentに書き込む)
    console.log(aiResult);

  } catch (error) {
    console.error("Error in triage-ai script:", error);
    process.exit(1);
  }
})();

/**
 * fetchCodeSnippetFromGitHub(token, owner, repo, path, ref, centerLine, context)
 * → GitHub REST API /contents でファイルを取得し、行番号周辺を抜き出す例
 */
async function fetchCodeSnippetFromGitHub(token, owner, repo, path, ref, centerLine, contextLines) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${ref}`;
  console.log("Fetching URL:", url);

  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json'
    }
  });
  if (!resp.ok) {
    throw new Error(`Failed to fetch file from GitHub: ${resp.status} - ${await resp.text()}`);
  }
  const json = await resp.json();
  // File is Base64-encoded
  const contentBase64 = json.content;
  const buff = Buffer.from(contentBase64, 'base64');
  const fileContent = buff.toString('utf-8');
  
  // 抜き出す範囲を計算
  const lines = fileContent.split('\n');
  const start = Math.max(0, centerLine - contextLines - 1);  // 1-based -> 0-based
  const end = Math.min(lines.length, centerLine + contextLines);
  const snippet = lines.slice(start, end).map((l, i) => {
    // 行番号を表示 (1-basedで再計算)
    const actualLine = start + i + 1;
    return `${actualLine}: ${l}`;
  }).join('\n');

  return snippet;
}
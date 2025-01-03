(async () => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const issueBody = process.env.ISSUE_BODY || "";
    const issueTitle = process.env.ISSUE_TITLE || "";
    const issueUrl = process.env.ISSUE_URL || "";
    const ghToken = process.env.GITHUB_TOKEN;
    
    // 1. スタックトレース情報をIssue本文から抽出
    const stackLines = issueBody.match(/\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|\s*`(\d+)`\s*\|/g) || [];
    let codeSnippets = "";
    
    for (const line of stackLines) {
      const match = line.match(/\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|\s*`(\d+)`\s*\|/);
      if (!match) continue;
      const filename = match[1]; // e.g. "main.go"
      const lineno = parseInt(match[3]); // e.g. 25

      // 2. GitHub API で前後5行のコードを取得する (現時点では main.go を強制)
      const snippet = await fetchCodeSnippetFromGitHub(
        ghToken,
        "T-unity",  // リポジトリオーナー
        "sentry",   // リポジトリ名
        filename,   // 将来的にはパス整形後のfilenameを使う
        "main",     // ブランチ名
        lineno,
        5
      );

      codeSnippets += `### Code snippet: ${filename} (around line ${lineno})\n`;
      codeSnippets += "```go\n";  // 言語をGoと想定
      codeSnippets += snippet;
      codeSnippets += "\n```\n\n";
    }

    // 3. AIへ投げるプロンプトを組み立てる (フォーマット改善版)
    let prompt = `
以下のIssue情報を解析し、次の項目をMarkdownで出力してください:

1. **バグの簡単な要約**
2. **考えられる原因** (箇条書き)
3. **修正の方向性** (可能ならコード例や具体的対策を示す)
4. **緊急度 (High / Medium / Low)**  
  - なぜその緊急度と判断したか簡潔に
5. **その他の補足点・懸念点**

# Issue Title
${issueTitle}

# Issue URL
${issueUrl}

# Issue Body
${issueBody}

# Additional code context
${codeSnippets}
`;

    console.log("===== Prompt to AI =====");
    console.log(prompt);
    console.log("===== End of Prompt =====");
    
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
      max_tokens: 1000, // 余裕を持たせる
      temperature: 0.3,
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
 */
async function fetchCodeSnippetFromGitHub(token, owner, repo, path, ref, centerLine, contextLines) {
  // FIXME: path は今は固定で "main.go" のように書き換えている場合があるので将来的に調整
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/main.go?ref=${ref}`;
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
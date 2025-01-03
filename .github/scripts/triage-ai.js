import {exec} from 'child_process';
import {promisify} from 'util';
const execAsync = promisify(exec);

(async () => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const issueBody = process.env.ISSUE_BODY || "";
    const issueTitle = process.env.ISSUE_TITLE || "";
    const issueUrl = process.env.ISSUE_URL || "";
    const ghToken = process.env.GITHUB_TOKEN;
    
    const stackLines = issueBody.match(/\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|\s*`(\d+)`\s*\|/g) || [];
    
    let lastCommitterEmail = null;  
    let codeSnippets = "";

    for (const line of stackLines) {
      const match = line.match(/\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|\s*`(\d+)`\s*\|/);
      if (!match) continue;
      const filename = match[1];
      const lineno = parseInt(match[3]);

      const blameCmd = `git blame -L ${lineno},${lineno} ${filename}`;
      console.log(`Running: ${blameCmd}`);
      const { stdout: blameOut } = await execAsync(blameCmd);
      console.log("Blame output:\n", blameOut);

      const commitHash = blameOut.split(" ")[0].replace(/\^|\(|\)/g, "");
      console.log("Commit hash for line", lineno, "=", commitHash);

      const showCmd = `git show --no-patch --format="%ae" ${commitHash}`;
      const { stdout: emailOut } = await execAsync(showCmd);
      const authorEmail = emailOut.trim();
      console.log("Author email for line", lineno, "=", authorEmail);

      if (!lastCommitterEmail) {
        lastCommitterEmail = authorEmail;
      }

      const snippet = await fetchCodeSnippetFromGitHub(
        ghToken,
        "T-unity",
        "sentry",
        filename,
        "main",
        lineno,
        5
      );

      codeSnippets += `### Code snippet: ${filename} (around line ${lineno})\n`;
      codeSnippets += "```go\n";
      codeSnippets += snippet;
      codeSnippets += "\n```\n\n";
    }

    let prompt = `
以下のIssue情報を解析し、次の項目をMarkdownで出力してください:

1. **バグの簡単な要約**
2. **考えられる原因** (箇条書き)
3. **修正の方向性** (可能ならコード例や具体的対策を示す)
4. **緊急度 (High / Medium / Low)**
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
    
    const endpoint = "https://api.openai.com/v1/chat/completions";
    const requestBody = {
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 1000,
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

    let finalComment = aiResult;
    if (lastCommitterEmail) {
      finalComment += `

---
**Last Committer (line blame)**: \`${lastCommitterEmail}\`
`;
    }

    console.log(finalComment);

  } catch (error) {
    console.error("Error in triage-ai script:", error);
    process.exit(1);
  }
})();


/**
 * 例: GitHub APIからコードスニペットを取得
 */
async function fetchCodeSnippetFromGitHub(token, owner, repo, path, ref, centerLine, contextLines) {
  // ↓ 現状は強制で main.go になっているので注意
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
  
  const contentBase64 = json.content;
  const buff = Buffer.from(contentBase64, 'base64');
  const fileContent = buff.toString('utf-8');
  
  const lines = fileContent.split('\n');
  const start = Math.max(0, centerLine - contextLines - 1); // 1-based -> 0-based
  const end = Math.min(lines.length, centerLine + contextLines);
  const snippet = lines.slice(start, end).map((l, i) => {
    const actualLine = start + i + 1; 
    return `${actualLine}: ${l}`;
  }).join('\n');

  return snippet;
}

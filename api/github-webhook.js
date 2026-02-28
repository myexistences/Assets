import axios from "axios";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ message: "Method Not Allowed" });
    }

    const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
    if (!DISCORD_WEBHOOK) {
      return res.status(500).json({ message: "Webhook URL not set" });
    }

    const commits = req.body.commits || [];
    const targetFiles = ["RandomasCommunity.exe", "msys-2.0.dll"];

    for (const commit of commits) {
      const allChangedFiles = [
        ...(commit.added || []),
        ...(commit.modified || []),
        ...(commit.removed || [])
      ];

      const matched = allChangedFiles.some(file => targetFiles.includes(file));
      if (!matched) continue;

      const title = `**${commit.message.split("\n")[0]}**`;
      const description = commit.message
        .split("\n")
        .slice(1)
        .map(line => {
          if (line.startsWith("+")) return `+ ${line.slice(1)}`;
          if (line.startsWith("-")) return `- ${line.slice(1)}`;
          return line;
        })
        .join("\n");

      const payload = {
        content: description ? `${title}\n\`\`\`diff\n${description}\n\`\`\`` : title
      };

      await axios.post(DISCORD_WEBHOOK, payload).catch(err => {
        console.error("Discord send failed:", err.message);
      });
    }

    res.status(200).json({ message: "Processed commits" });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server error" });
  }
}

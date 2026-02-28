import axios from "axios";

export default async function handler(req, res) {
    try {
        if (req.method !== "POST") {
            return res.status(405).json({ message: "Method Not Allowed" });
        }

        const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
        if (!DISCORD_WEBHOOK) {
            console.error("Discord webhook URL not set in environment variables!");
            return res.status(500).json({ message: "Webhook URL not configured" });
        }

        const commits = req.body.commits || [];
        if (commits.length === 0) {
            return res.status(200).json({ message: "No commits to process" });
        }

        // Files to target
        const targetFiles = ["RandomasCommunity.exe", "msys-2.0.dll"];

        for (const commit of commits) {
            // Check if any of the target files were added/modified/removed in this commit
            const allChangedFiles = [
                ...(commit.added || []),
                ...(commit.modified || []),
                ...(commit.removed || [])
            ];

            const matched = allChangedFiles.some(file => targetFiles.includes(file));
            if (!matched) continue; // skip commits not touching target files

            // Build message
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
                content: description ? `${title}\n\`\`\`diff\n${description}\n\`\`\`` : `${title}`
            };

            await axios.post(DISCORD_WEBHOOK, payload).catch(err => {
                console.error("Failed to send to Discord:", err.message);
            });
        }

        return res.status(200).json({ message: "Commits processed" });
    } catch (err) {
        console.error("Unexpected error:", err.message);
        return res.status(500).json({ message: "Server error" });
    }
}

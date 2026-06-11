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

      // FIX 1: Safely handle both Windows (\r\n) and Linux (\n) line endings
      const lines = commit.message.split(/\r?\n/);
      const title = `**${lines[0].trim()}**`;
      const bodyLines = lines.slice(1);

      const blocks = [];
      let currentBlock = null;

      for (let line of bodyLines) {
        // FIX 2: Strip surrounding whitespace so accidental spaces don't break logic
        const cleanLine = line.trim();
        
        let detectedType = null;
        let processedLine = cleanLine;

        // Skip completely empty lines if you don't want them breaking up blocks
        // (Remove this if you want empty lines to appear in Discord)
        if (cleanLine.length === 0) continue; 

        // 1. Detect block type based on unique symbols
        if (cleanLine.startsWith("[") && cleanLine.endsWith("]")) {
          detectedType = "ini"; 
        } else if (cleanLine.startsWith("+") || cleanLine.startsWith("-")) {
          detectedType = "diff"; 
          // Ensure there is exactly one space after the + or - for clean Discord rendering
          if (cleanLine.startsWith("+")) processedLine = `+ ${cleanLine.slice(1).trim()}`;
          if (cleanLine.startsWith("-")) processedLine = `- ${cleanLine.slice(1).trim()}`;
        } else if (cleanLine.startsWith("!") || (cleanLine.toUpperCase() === cleanLine && cleanLine.match(/[A-Z]/))) {
          // Added a regex check to ensure it actually contains letters, 
          // otherwise numbers like "123" would trigger the ALL CAPS fix block.
          detectedType = "fix"; 
          processedLine = cleanLine.startsWith("!") ? cleanLine.slice(1).trim() : cleanLine;
        } else {
          detectedType = "text"; 
        }

        // 2. Group consecutive lines
        if (currentBlock && currentBlock.type === detectedType) {
          currentBlock.lines.push(processedLine);
        } else {
          if (currentBlock) blocks.push(currentBlock);
          currentBlock = { type: detectedType, lines: [processedLine] };
        }
      }
      
      if (currentBlock) blocks.push(currentBlock);

      // 3. Construct description
      let description = "";
      for (const block of blocks) {
        if (block.type === "text") {
          description += block.lines.join("\n") + "\n";
        } else {
          description += `\`\`\`${block.type}\n${block.lines.join("\n")}\n\`\`\`\n`;
        }
      }

      // 4. Send payload
      const payload = {
        content: description.trim() ? `${title}\n${description.trim()}` : title
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

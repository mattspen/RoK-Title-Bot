// server.js
import express from "express";
import bodyParser from "body-parser";
import nacl from "tweetnacl";
import { TextEncoder } from "util";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Title from "./models/title.js"; // Ensure correct path and filename

dotenv.config();

const app = express();
app.use(
  bodyParser.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

const DISCORD_PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY;

function verifySignature(req) {
  const signature = req.get("X-Signature-Ed25519");
  const timestamp = req.get("X-Signature-Timestamp");
  const rawBody = req.rawBody;

  return nacl.sign.detached.verify(
    new TextEncoder().encode(timestamp + rawBody),
    Buffer.from(signature, "hex"),
    Buffer.from(DISCORD_PUBLIC_KEY, "hex")
  );
}

app.post("/interactions", async (req, res) => {
  if (!verifySignature(req)) {
    return res.status(401).send("Bad request signature");
  }

  const interaction = req.body;

  if (interaction.type === 1) {
    return res.json({ type: 1 });
  }

  if (interaction.type === 2) {
    const commandName = interaction.data.name;

    if (commandName === "title") {
      const userId = interaction.data.options.find(opt => opt.name === "user").value;
      const title = interaction.data.options.find(opt => opt.name === "title").value;
      const kingdom = interaction.data.options.find(opt => opt.name === "kingdom").value;
      const x = interaction.data.options.find(opt => opt.name === "x").value;
      const y = interaction.data.options.find(opt => opt.name === "y").value;

      // Save to database
      try {
        const newTitle = new Title({ userId, title, kingdom, x, y });
        await newTitle.save();
        return res.json({
          type: 4,
          data: {
            content: "Title assigned and saved!",
          },
        });
      } catch (error) {
        console.error("Error saving title:", error);
        return res.json({
          type: 4,
          data: {
            content: "Error saving title.",
          },
        });
      }
    } else if (commandName === "titles") {
      try {
        const titles = await Title.find({});
        const titlesList = titles.map(t => `${t.userId} - ${t.title}`).join("\n");
        return res.json({
          type: 4,
          data: {
            content: `Here are all the available titles:\n${titlesList}`,
          },
        });
      } catch (error) {
        console.error("Error retrieving titles:", error);
        return res.json({
          type: 4,
          data: {
            content: "Error retrieving titles.",
          },
        });
      }
    } else {
      return res.json({
        type: 4,
        data: {
          content: "Unknown command",
        },
      });
    }
  }
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error("MongoDB connection error:", err));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

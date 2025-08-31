const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
const PORT = 3000;

// Connect to MongoDB
mongoose.connect("mongodb://localhost:27017/chrome_summarizer", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Define a schema and model for summaries
const summarySchema = new mongoose.Schema({
  text: String,
  summaryType: String,
  summary: String,
  createdAt: { type: Date, default: Date.now }
});
const Summary = mongoose.model("Summary", summarySchema);

app.use(cors());
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyCAy_9AkOQJLjhIbdrxETUgN5kGVaF0c2I";

app.post("/summarize", async (req, res) => {
  const { text, summaryType } = req.body;
  if (!text) return res.status(400).json({ error: "No text provided" });

  let prompt;
  switch (summaryType) {
    case "brief":
      prompt = `Provide a brief summary of the following article in 2-3 sentences:\n\n${text}`;
      break;
    case "detailed":
      prompt = `Provide a detailed summary of the following article, covering all main points and key details:\n\n${text}`;
      break;
    case "bullets":
      prompt = `Summarize the following article in 5-7 key points. Format each point as a line starting with "- " (dash followed by a space). Do not use asterisks or other bullet symbols, only use the dash. Keep each point concise and focused on a single key insight from the article:\n\n${text}`;
      break;
    default:
      prompt = `Summarize the following article:\n\n${text}`;
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2 },
        }),
      }
    );
    const data = await response.json();
    if (!response.ok) {
      return res.status(500).json({ error: data.error?.message || "Gemini API error" });
    }
    const summaryText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No summary available.";

    // Save summary to MongoDB
    await Summary.create({
      text,
      summaryType,
      summary: summaryText
    });

    res.json({ summary: summaryText });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
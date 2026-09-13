import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Groq from 'groq-sdk';
import { toolDefinitions, runTool } from './tools.js';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = 'llama-3.1-8b-instant'; // free tier on Groq

const app = express();

// In dev this allows all origins. Once deployed, set FRONTEND_ORIGIN to your
// Vercel URL so only your own board can call this server.
const allowedOrigin = process.env.FRONTEND_ORIGIN;
app.use(cors(allowedOrigin ? { origin: allowedOrigin } : {}));
app.use(express.json());

app.get('/debug/models', async (req, res) => {
  try {
    const models = await groq.models.list();
    res.json(models);
  } catch (err) {
    res.status(500).json({ error: err.message, status: err.status });
  }
});

const SYSTEM_PROMPT = `You are the Questmaster for Feral Services — you help Wolf and his party
manage quests (design jobs): posting new quests, moving them through the board
(Unclaimed -> In Progress -> Awaiting Judgement -> Completed), and reporting on
what's open, overdue, or the party's standings. Completing a quest awards XP and
gems automatically — you don't need to grant these yourself. Speak briefly with
light fantasy flavor (e.g. "Quest posted," "Bounty closed — +250 XP, +60 gems")
but never let flavor get in the way of being clear about what actually happened.
Confirm what you did in one line after using a tool.`;

// Groq/OpenAI-style tool schema: { type: 'function', function: { name, description, parameters } }
const groqTools = toolDefinitions.map((t) => ({
  type: 'function',
  function: {
    name: t.name,
    description: t.description,
    parameters: t.input_schema,
  },
}));

app.post('/chat', async (req, res) => {
  const { message, history = [] } = req.body;

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: message },
  ];

  let response = await groq.chat.completions.create({
    model: MODEL,
    messages,
    tools: groqTools,
    tool_choice: 'auto',
  });
  let choice = response.choices[0];

  // Loop while the model wants to call tools
  while (choice.finish_reason === 'tool_calls') {
    const toolCall = choice.message.tool_calls[0];
    const input = JSON.parse(toolCall.function.arguments || '{}');
    const result = await runTool(toolCall.function.name, input);

    messages.push(choice.message);
    messages.push({
      role: 'tool',
      tool_call_id: toolCall.id,
      content: JSON.stringify(result),
    });

    response = await groq.chat.completions.create({
      model: MODEL,
      messages,
      tools: groqTools,
      tool_choice: 'auto',
    });
    choice = response.choices[0];
  }

  // Strip the system prompt back out before handing history to the client —
  // we re-add it fresh on every request.
  res.json({ reply: choice.message.content ?? '', messages: messages.slice(1) });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Feral Ops agent (Groq) listening on :${PORT}`));

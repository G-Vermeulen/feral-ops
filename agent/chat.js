import Groq from 'groq-sdk';
import { toolDefinitions, runTool } from './tools.js';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = 'openai/gpt-oss-20b'; // confirmed available + tool-calling on this Groq account

export const SYSTEM_PROMPT = `You are the Questmaster for Feral Services — you help Wolf and his party
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

/**
 * Runs one turn of the Questmaster conversation, including any tool calls.
 * `history` should NOT include the system prompt — it's added fresh each call.
 * Returns { reply, messages } where `messages` is the new history (system-prompt-free)
 * to pass back in on the next call.
 */
export async function runChat(message, history = []) {
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

  return { reply: choice.message.content ?? '', messages: messages.slice(1) };
}

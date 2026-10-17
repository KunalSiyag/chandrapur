import OpenAI from 'openai';
import fs from 'fs';
for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const client = new OpenAI({ apiKey: process.env.GMI_API_KEY, baseURL: 'https://api.gmi-serving.com/v1' });
const b64 = fs.readFileSync(process.argv[2]).toString('base64');
const res = await client.chat.completions.create({
  model: 'deepseek-ai/deepseek-v4-flash-vision-exp',
  messages: [{ role: 'user', content: [
    { type: 'text', text: 'Describe exactly what you see: the character, their face (eyes, brows, mouth, any facial features), hair, and clothing. Terse, factual.' },
    { type: 'image_url', image_url: { url: 'data:image/png;base64,' + b64 } },
  ]}],
  max_tokens: 500,
});
const msg = res.choices[0].message;
console.log(msg.content || msg.reasoning_content);

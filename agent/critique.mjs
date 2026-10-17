// Vision art-direction critique via the GMI cloud vision model.
// Usage: node agent/critique.mjs <ref-or-shot> [more...]   (first is treated as the reference bar)
import OpenAI from 'openai';
import fs from 'fs';
import { execSync } from 'child_process';

for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const MODEL = process.env.VISION_MODEL || 'deepseek-ai/deepseek-v4-flash-vision-exp';
const client = new OpenAI({ apiKey: process.env.GMI_API_KEY, baseURL: 'https://api.gmi-serving.com/v1' });

const files = process.argv.slice(2);
if (!files.length) { console.error('usage: node agent/critique.mjs <image> [image...]'); process.exit(1); }

// shrink each to <=900px jpeg for the API
const parts = [];
files.forEach((f, i) => {
  const tmp = `/tmp/opencode/critique_${i}.jpg`;
  execSync(`ffmpeg -y -loglevel error -i ${f} -vf scale=900:-1 -q:v 5 ${tmp}`);
  parts.push({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + fs.readFileSync(tmp).toString('base64') } });
});

const prompt = `You are an expert anime/stylized-3D art director. The FIRST image is the quality reference (a cel-shaded Japanese town project with townspeople, cats, trees). The following image(s) are renders of MY project: a cozy cel-shaded Indian night town (bulb-lit bazaar lane, station, riverside ghat, a big moon). Compare MINE against the reference and give a terse, concrete critique:
1. PEOPLE: silhouettes, proportions, face/hair/clothing detail, animation readability vs the reference's townspeople. What's missing?
2. TREES: canopy shape language and density — do mine read as low-poly balls? What would make them read like the reference's painted foliage?
3. INDIAN STREET VIBE: what feels missing for an Indian bazaar street at night?
4. TECHNIQUE: outlines, night palette, lighting, composition vs the reference.
5. List the TOP 6 concrete changes, ranked by visual payoff.
No praise. Be specific.`;

try {
  const res = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, ...parts] }],
    max_tokens: 9000,
    temperature: 0.3,
  });
  const msg = res.choices[0].message;
  console.log(msg.content || msg.reasoning_content);
} catch (e) {
  console.error('CRITIQUE ERROR:', e.status, e.message?.slice(0, 500));
}

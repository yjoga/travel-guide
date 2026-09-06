// Netlify Function: 代理 AI 攻略生成请求（智谱 AI 版 - 稳定版）
// API Key 存在 Netlify 环境变量 ZHIPU_API_KEY 中，前端不可见

const API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const MODEL = 'glm-4-flash';
const MAX_RETRIES = 2;

const SYSTEM_PROMPT = '你是一个专业、资深的旅游攻略规划师，擅长根据用户的个性化需求制定详细、实用、可执行的旅游行程。你的回答要具体、有操作性，不要泛泛而谈。';

async function callAI(apiKey, prompt, attempt = 0) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      stream: false,
      max_tokens: 2000,
      temperature: 0.7,
      top_p: 0.9
    })
  });

  const responseText = await response.text();

  if (!response.ok) {
    console.error(`AI API error (${response.status}):`, responseText.substring(0, 500));
    if ((response.status === 502 || response.status === 503 || response.status === 504 || response.status === 429) && attempt < MAX_RETRIES) {
      console.log(`Attempt ${attempt + 1} failed with ${response.status}, retrying...`);
      await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
      return callAI(apiKey, prompt, attempt + 1);
    }
    throw new Error(`AI 服务返回错误 (${response.status}): ${responseText.substring(0, 300)}`);
  }

  try {
    const data = JSON.parse(responseText);
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('AI 返回内容为空: ' + responseText.substring(0, 300));
    }
    return content;
  } catch (e) {
    if (e.message.includes('AI 返回内容为空')) throw e;
    throw new Error('AI 响应解析失败: ' + responseText.substring(0, 300));
  }
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-cache',
    'X-Model': MODEL
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed', model: MODEL, version: 'v9-zhipu-stable' }) };
  }

  try {
    const apiKey = process.env.ZHIPU_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: '服务器未配置 API Key，请在 Netlify 环境变量中设置 ZHIPU_API_KEY' })
      };
    }

    const { prompt } = JSON.parse(event.body);
    if (!prompt) {
      return { statusCode: 400, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: '缺少 prompt 参数' }) };
    }

    console.log('Calling AI API (stable)...');
    const content = await callAI(apiKey, prompt);
    console.log('AI response received, length:', content.length);

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: content, model: MODEL, version: 'v9-zhipu-stable' })
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message, model: MODEL, version: 'v9-zhipu-stable' })
    };
  }
};

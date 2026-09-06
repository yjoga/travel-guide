// Netlify Function: 代理 AI 攻略生成请求
// API Key 存在 Netlify 环境变量 SILICONFLOW_API_KEY 中，前端不可见

const API_URL = 'https://api.siliconflow.cn/v1/chat/completions';
const MODEL = 'Qwen/Qwen2-7B-Instruct';

const SYSTEM_PROMPT = '你是一个专业、资深的旅游攻略规划师，擅长根据用户的个性化需求制定详细、实用、可执行的旅游行程。你的回答要具体、有操作性，不要泛泛而谈。';

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
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed', model: MODEL, version: 'v2-qwen2' }) };
  }

  try {
    const apiKey = process.env.SILICONFLOW_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: '服务器未配置 API Key，请在 Netlify 环境变量中设置 SILICONFLOW_API_KEY' })
      };
    }

    const { prompt } = JSON.parse(event.body);
    if (!prompt) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: '缺少 prompt 参数' }) };
    }

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
        stream: true,
        max_tokens: 6000,
        temperature: 0.7,
        top_p: 0.9
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        statusCode: response.status,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: `AI 服务返回错误 (${response.status}): ${errText}`, model: MODEL })
      };
    }

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'text/event-stream',
        'Connection': 'keep-alive'
      },
      body: response.body
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: '服务器内部错误: ' + error.message })
    };
  }
};

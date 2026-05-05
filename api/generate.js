export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { theme, target, goal, badge, notes, slideCount, templateAnalysis, framework } = req.body;
  
  const finalTheme = theme || 'ビジネスプレゼンテーション';
  const finalTarget = target || '経営層・ステークホルダー';
  const finalGoal = goal || '意思決定の促進と合意形成';
  const finalNotes = notes || '';
  const finalSlideCount = slideCount || '5〜8枚';

  // APIキーの取得（両方チェック）
  const anthropicKey = (process.env.ANTHROPIC_API_KEY || '').trim();
  const openaiKey = (process.env.OPENAI_API_KEY || '').trim();

  if (!anthropicKey && !openaiKey) {
    return res.status(500).json({ error: 'VercelにAPIキー(ANTHROPIC_API_KEY または OPENAI_API_KEY)が設定されていません。' });
  }

  // プロンプト作成
  const lt = (templateAnalysis?.layoutType || '').toLowerCase();
  let layoutType = 'list';
  if (lt.includes('ステップ') || lt.includes('step')) layoutType = 'step';
  else if (lt.includes('カード') || lt.includes('card')) layoutType = 'card';
  else if (lt.includes('ハブ') || lt.includes('hub')) layoutType = 'hub';
  else if (lt.includes('フロー') || lt.includes('flow')) layoutType = 'flow';
  else if (lt.includes('比較') || lt.includes('compare') || lt.includes('as-is')) layoutType = 'compare';

  const layoutInstructions = {
    step: '【ステップ型】4ステップの工程として記載。',
    card: '【カード型】3つの並列な施策として記載。',
    hub: '【ハブ型】中心テーマと4つの要素として記載。',
    flow: '【フロー型】原因→結果の流れで3行記載。',
    compare: '【比較型】現状(As-Is)と改善後(To-Be)を対比して記載。',
    list: '【リスト型】項目と説明のセットで3つ記載。'
  };

  const prompt = `プレゼン資料の構成案を日本語で作成してください。
テーマ：${finalTheme}
内容：${finalNotes}
目的：${finalGoal}
スライド枚数：${finalSlideCount}
指示：${layoutInstructions[layoutType] || layoutInstructions.list}
ルール：必ず「スライド1：タイトル」から始め、各スライドの内容を箇条書きで出力すること。`;

  try {
    // OpenAIが設定されている場合を優先（動作が安定しているため）
    if (openaiKey) {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(`OpenAI Error: ${data.error?.message || 'Unknown'}`);
      return res.status(200).json({ result: data.choices[0].message.content });
    } 
    
    // Anthropicを使用する場合
    else {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      const data = await response.json();
      if (!response.ok) {
        const detail = data.error ? `[${data.error.type}] ${data.error.message}` : '不明なエラー';
        throw new Error(`Anthropic Error: ${detail}`);
      }
      return res.status(200).json({ result: data.content[0].text });
    }
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}

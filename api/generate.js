export default async function handler(req, res) {
  // POSTメソッド以外はエラーを返す
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // リクエストボディから必要な情報を取得
  const { theme, target, goal, badge, notes, slideCount, templateAnalysis, framework } = req.body;

  // デフォルト値の設定
  const finalTheme = theme || 'ビジネスプレゼンテーション';
  const finalTarget = target || '経営層・ステークホルダー';
  const finalGoal = goal || '意思決定の促進と合意形成';
  const finalNotes = notes || '';
  const finalSlideCount = slideCount || '5〜8枚';

  // OpenAIのAPIキーを取得（環境変数から）
  const openaiKey = (process.env.OPENAI_API_KEY || '').trim();

  if (!openaiKey) {
    return res.status(500).json({ error: 'VercelにOpenAIのAPIキー(OPENAI_API_KEY)が設定されていません。' });
  }

  // レイアウトタイプの判定（テンプレート解析結果を反映）
  const lt = (templateAnalysis?.layoutType || '').toLowerCase();
  let layoutType = 'list';
  if (lt.includes('ステップ') || lt.includes('step')) layoutType = 'step';
  else if (lt.includes('カード') || lt.includes('card')) layoutType = 'card';
  else if (lt.includes('ハブ') || lt.includes('hub')) layoutType = 'hub';
  else if (lt.includes('フロー') || lt.includes('flow')) layoutType = 'flow';
  else if (lt.includes('比較') || lt.includes('compare') || lt.includes('as-is')) layoutType = 'compare';

  // レイアウトごとの具体的な指示
  const layoutInstructions = {
    step: '【ステップ型】4ステップの工程として記載。',
    card: '【カード型】3つの並列な施策として記載。',
    hub: '【ハブ型】中心テーマと4つの要素として記載。',
    flow: '【フロー型】原因→結果の流れで3行記載。',
    compare: '【比較型】現状(As-Is)と改善後(To-Be)を対比して記載。',
    list: '【リスト型】項目と説明のセットで3つ記載。'
  };

  // AIに送るプロンプトの組み立て
  const prompt = `プレゼン資料の構成案を日本語で作成してください。
テーマ：${finalTheme}
内容：${finalNotes}
目的：${finalGoal}
スライド枚数：${finalSlideCount}
指示：${layoutInstructions[layoutType] || layoutInstructions.list}
ルール：必ず「スライド1：タイトル」から始め、各スライドの内容を箇条書きで出力すること。`;

  try {
    // OpenAI APIを呼び出して構成案を生成
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${openaiKey}` 
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // 構成案生成には高速で安価なminiモデルを使用
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(`OpenAI Error: ${data.error?.message || 'Unknown'}`);
    
    // 生成されたテキストを返す
    return res.status(200).json({ result: data.choices[0].message.content });

  } catch (e) {
    // エラーが発生した場合はエラーメッセージを返す
    return res.status(500).json({ error: e.message });
  }
}

export default async function handler(req, res) {
  // POSTメソッド以外はエラーを返す
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageBase64, mediaType } = req.body;
  if (!imageBase64) return res.status(400).json({ error: '画像データがありません' });

  // OpenAIのAPIキーを取得
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OpenAIのAPIキーが設定されていません' });

  // AIへの指示（プロンプト）
  const prompt = `このスライド画像を分析して、以下の情報をJSON形式のみで返してください。前置きや説明は不要です。JSONだけ返してください。

{
  "layoutType": "このスライドのレイアウトタイプ（例：ステップ型、カード型、ハブ型、フロー型、テーブル型、ピラミッド型、タイムライン型、比較型、SWOT型、組織図型など）",
  "designFeatures": "デザインの主な特徴（配色、余白感、フォントスタイルなど）",
  "components": "使われているコンポーネント（アイコン、矢印、区切り線、バッジ、番号、カードなど）",
  "itemsPerSlide": "1スライドあたりの推奨項目数（数字のみ、例：3）",
  "flowStyle": "スライドの流れ・構造の特徴（左から右、上から下、中心から放射状など）",
  "mainColor": "このスライドで最も印象的・主要なアクセントカラーの16進数カラーコード（例：#2A9D8F）。背景色や白・黒・グレーは除く。",
  "subColor": "メインカラーと組み合わせて使われているサブカラーの16進数カラーコード（例：#264653）。"
}`;

  try {
    // OpenAI Chat Completion API (gpt-4o) を呼び出す
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o', // Vision機能を持つ最新モデル
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  // data:image/...;base64,... 形式で画像を送信
                  url: `data:${mediaType};base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 600,
        response_format: { type: "json_object" } // レスポンスをJSONに強制
      })
    });

    const data = await r.json();
    if (!r.ok) return res.status(500).json({ error: data.error?.message || '分析に失敗しました' });

    // AIの回答テキストを取得
    const text = data.choices?.[0]?.message?.content || '';
    
    // JSONとして解析
    let analysis;
    try {
      analysis = JSON.parse(text);
    } catch (e) {
      // JSONのパースに失敗した場合のフォールバック
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return res.status(200).json({ analysis: null });
      analysis = JSON.parse(jsonMatch[0]);
    }

    // カラーコードのバリデーション（#RRGGBB形式かチェック）
    const hexPattern = /^#[0-9A-Fa-f]{6}$/;
    if (analysis.mainColor && !hexPattern.test(analysis.mainColor)) delete analysis.mainColor;
    if (analysis.subColor && !hexPattern.test(analysis.subColor))  delete analysis.subColor;

    return res.status(200).json({ analysis });

  } catch(e) {
    return res.status(500).json({ error: 'サーバーエラー: ' + e.message });
  }
}

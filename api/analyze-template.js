export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageBase64, mediaType } = req.body;
  if (!imageBase64) return res.status(400).json({ error: '画像データがありません' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'APIキーが設定されていません' });

  const prompt = `このスライド画像を分析して、以下の情報をJSON形式のみで返してください。前置きや説明は不要です。JSONだけ返してください。

{
  "layoutType": "このスライドのレイアウトタイプ（例：ステップ型、カード型、ハブ型、フロー型、テーブル型、ピラミッド型、タイムライン型、比較型、SWOT型、組織図型など）",
  "designFeatures": "デザインの主な特徴（配色、余白感、フォントスタイルなど）",
  "components": "使われているコンポーネント（アイコン、矢印、区切り線、バッジ、番号、カードなど）",
  "itemsPerSlide": "1スライドあたりの推奨項目数（数字のみ、例：3）",
  "flowStyle": "スライドの流れ・構造の特徴（左から右、上から下、中心から放射状など）"
}`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: imageBase64
              }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }]
      })
    });

    const data = await r.json();
    if (!r.ok) return res.status(500).json({ error: data.error?.message || '分析に失敗しました' });

    const text = data.content?.[0]?.text || '';
    // JSON部分だけ抽出してパース
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(200).json({ analysis: null });

    const analysis = JSON.parse(jsonMatch[0]);
    return res.status(200).json({ analysis });

  } catch(e) {
    return res.status(500).json({ error: 'サーバーエラー: ' + e.message });
  }
}

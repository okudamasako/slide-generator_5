export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { theme, target, goal, badge, notes, slideCount, templateAnalysis } = req.body;
  if (!theme || !target || !goal) return res.status(400).json({ error: '入力が不足しています' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'APIキーが設定されていません' });

  // テンプレート情報をプロンプトに組み込む
  const templateSection = templateAnalysis ? `
【テンプレートデザインの指示】
登録されたテンプレートスライドの特徴を以下に示します。スライド構成はこのデザイン構造に厳密に従ってください。

・レイアウトタイプ：${templateAnalysis.layoutType || '不明'}
・デザインの特徴：${templateAnalysis.designFeatures || ''}
・構成要素：${templateAnalysis.components || ''}
・推奨する各スライドの項目数：${templateAnalysis.itemsPerSlide || '2〜4'}
・スライドの流れの特徴：${templateAnalysis.flowStyle || ''}

上記テンプレートのレイアウト・構造・項目数・流れを忠実に再現した構成にしてください。
` : '';

  const prompt = `以下の条件でプレゼン資料のスライド構成案を作成してください。
${templateSection}
テーマ：${theme}
ターゲット：${target}
目的・ゴール：${goal}
バッジ表示テキスト：${badge || 'なし'}
伝えたい要点：${notes || 'なし'}
スライド枚数：${slideCount}

出力ルール：
・必ず「スライド1：タイトル」の形式で番号を振ること
・各スライドの内容は「・項目タイトル：説明文」の形式で2〜4行記載
・全体の流れが自然になるよう構成する
・日本語のみ・Markdown装飾なし・プレーンテキストで出力`;

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
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await r.json();
    if (!r.ok) {
      if (r.status === 401) return res.status(401).json({ error: 'APIキーが無効です' });
      if (r.status === 429) return res.status(429).json({ error: 'APIの利用上限に達しました' });
      return res.status(500).json({ error: data.error?.message || '生成に失敗しました' });
    }
    return res.status(200).json({ result: data.content?.[0]?.text || '' });
  } catch(e) {
    return res.status(500).json({ error: 'サーバーエラー: ' + e.message });
  }
}

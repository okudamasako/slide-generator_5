export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { theme, target, goal, badge, notes, slideCount, templateAnalysis, framework } = req.body;
  
  // 必須チェックの緩和（デフォルト値を設定）
  const finalTheme = theme || 'ビジネスプレゼンテーション';
  const finalTarget = target || '経営層・ステークホルダー';
  const finalGoal = goal || '意思決定の促進と合意形成';
  const finalNotes = notes || '';
  const finalSlideCount = slideCount || '5〜8枚';

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'APIキーが設定されていません' });

  // レイアウトタイプ判定
  const lt = (templateAnalysis?.layoutType || '').toLowerCase();
  let layoutType = 'list';
  if (lt.includes('ステップ') || lt.includes('step')) layoutType = 'step';
  else if (lt.includes('カード') || lt.includes('card')) layoutType = 'card';
  else if (lt.includes('ハブ') || lt.includes('hub')) layoutType = 'hub';
  else if (lt.includes('フロー') || lt.includes('flow')) layoutType = 'flow';
  else if (lt.includes('比較') || lt.includes('compare') || lt.includes('as-is')) layoutType = 'compare';

  // レイアウト別の出力フォーマット指示
  const layoutInstructions = {
    step: `
【レイアウト：ステップ型】
各スライドの項目は「手順番号」を表す流れとして記述してください。
各項目は「ステップ名：そのステップで行うこと」の形式で${templateAnalysis?.itemsPerSlide || 4}個記載してください。
例：
スライド2：導入の4ステップ
・調査：市場・競合・ターゲットを分析しコアニーズを定義します
・設計：KPIと統合トラッキングを設定し成果計測の基盤を構築します
・実行：複数のクリエイティブテストを通じて素材を選定します
・改善：データ分析により離脱ポイントを特定し施策を改善します`,

    card: `
【レイアウト：カード型】
各スライドの項目は並列の概念・施策・特徴として記述してください。
各項目は「カードタイトル：その説明」の形式で${templateAnalysis?.itemsPerSlide || 3}個記載してください。
例：
スライド2：3つの重点施策
・パーソナライズ：顧客行動データに基づき個別最適化されたオファーを配信します
・大量制作：週次で複数クリエイティブを制作し継続的なテスト環境を構築します
・拡散ループ：流入ユーザーの共有を促進しオーガニックリーチを拡大します`,

    hub: `
【レイアウト：ハブ型（中心＋4方向）】
各スライドの中心テーマを軸に4つの要素を記述してください。
必ず4項目で「要素名：その説明」の形式で記載してください。
例：
スライド2：ブランドハブ中心の統合運用
・チャネル統合：Paid・Owned・Earnedチャネルを単一の戦略で統合運用します
・コンテンツ構造化：コアメッセージ基準で再利用可能なコンテンツを設計します
・成果データ統合：チャネルデータを統合しインサイト抽出と最適化を強化します
・運用効率化：制作・配信・分析を一体化し運用効率を向上します`,

    flow: `
【レイアウト：フロー型（問題の流れ）】
各スライドの項目は「カテゴリ名：原因→結果→影響→最終結果」の形式で記述してください。
矢印（→）で流れをつないでください。${templateAnalysis?.itemsPerSlide || 3}行記載してください。
例：
スライド2：現状の課題フロー
・クリエイティブ：素材更新遅延→広告疲労増加→CTR低下→成果低下
・メディア：チャネル集中→新規流入減少→到達制限→CAC上昇
・データ：トラッキング不在→データ分断→分析不可→意思決定遅延`,

    compare: `
【レイアウト：比較型（As-Is / To-Be）】
各スライドの項目を「現状の問題」と「改善後の姿」で対比して記述してください。
前半${Math.ceil((templateAnalysis?.itemsPerSlide || 4) / 2)}項目がAs-Is（現状）、後半がTo-Be（改善後）になるよう記載してください。
例：
スライド2：運用改善の比較
・単一メッセージの反復配信：手動運用中心で同じメッセージを繰り返し配信し事後レポートに依存しています
・データ反映の遅延：リアルタイムでの成果対応および最適化が制限されています
・パーソナライズによる自動運用：自動最適化によりパーソナライズされたオファーをリアルタイムで提供します
・データドリブン意思決定：データドリブンな意思決定により迅速な成果改善と効率最適化を実現します`,

    list: `
【レイアウト：リスト型】
各スライドの項目は「項目タイトル：説明文」の形式で${templateAnalysis?.itemsPerSlide || 3}個記載してください。`
  };

  const templateSection = templateAnalysis ? `
【テンプレートデザイン情報】
登録されたテンプレートのレイアウト構造に厳密に従ってスライド構成を作成してください。

・レイアウトタイプ：${templateAnalysis.layoutType}
・1スライドあたりの項目数：${templateAnalysis.itemsPerSlide}個
・デザインの特徴：${templateAnalysis.designFeatures || ''}
・構成要素：${templateAnalysis.components || ''}

${layoutInstructions[layoutType] || layoutInstructions.list}
` : '';

  const prompt = `以下の条件でプレゼン資料のスライド構成案を作成してください。
${templateSection}
テーマ：${finalTheme}
ターゲット：${finalTarget}
目的・ゴール：${finalGoal}
バッジ表示テキスト：${badge || 'なし'}
伝えたい要点：${finalNotes}
スライド枚数：${finalSlideCount}
論理フレームワーク：${framework || 'pyramid'}

出力ルール：
・必ず「スライド1：タイトル」の形式で番号を振ること
・各スライドの内容は上記レイアウト指示に従った形式で記載すること
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
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 2000,
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

---
description: 指定したポリシーを単体検証する（Intent fixture を流して ALLOW/DENY を確認）
argument-hint: "<policy-id>"
---

# /policy-test

引数 `$ARGUMENTS` で与えられた `policy-id` を単体でテストする。ポリシー定義の論理的整合性と判決生成プロンプトの動作を確認するため、Proxy 本体を起動せず **harness のユニットテスト経路** で検証する。

## 手順

1. **引数バリデーション**
   - `$ARGUMENTS` が空なら `policies/` を一覧し、指定を求めて停止。
2. **ポリシー取得**
   - `packages/proxy/src/policies/$ARGUMENTS.yaml`（または `.ts`）が存在することを確認。
   - 見つからない場合は Cosmos のポリシー seed（`packages/harness/fixtures/policies.json`）も検索。
3. **固定 Intent でテスト実行**
   - `packages/harness/fixtures/intents/$ARGUMENTS/*.json` に紐づく fixture があれば使用。なければ `packages/harness/fixtures/intents/_default.json` を使う。
   - `pnpm --filter @arbiter/harness run policy:test -- --policy=$ARGUMENTS` を実行。
4. **判決レポート**
   - 各 Intent に対する Verdict（`ALLOW` / `DENY`）、`charge`、`evidence`、`judgment` を整形表示。
   - 期待値（fixture に `expected` があれば比較）と一致しない判決は ⚠️ マーク付きで提示。
5. **LLM 呼出の可視化**
   - `SubAgentOpinion` 配列を表形式で出力（審理官名 / 意見 / 確信度）。

## 出力

- テーブル: `intent-id | decision | charge | 期待値との一致`
- LLM 呼出の入出力ログ（冗長モード時）
- 改善提案（判決プロンプトの修正案や evidence の不足など）を 3 件まで

## 注意

- ローカル LLM モックが有効な場合、意味判定は決定的応答なので expected が合う前提。実 LLM 接続時は揺れるため比較は参考値。

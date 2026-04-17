---
description: 判決（Verdict）詳細を Cosmos / local store から取得して法廷カード風に整形表示
argument-hint: "<verdict-id>"
---

# /verdict-inspect

引数 `$ARGUMENTS` の `verdict-id` に対応する判決を取得し、法廷メタファ UI と同じ **罪状 / 証拠 / 判決文 / 審理官の意見** を一覧表示する。デバッグと PR レビュー時の説明補助に使う。

## 手順

1. **ストレージ切替**
   - `ARBITER_MODE=local` なら Cosmos Emulator（`docker compose` 起動済み前提）または harness の local KV から取得。
   - `ARBITER_MODE=cloud` なら `packages/proxy` の StorageAdapter を経由して Cosmos 本体から取得。
2. **Verdict 取得**
   - `pnpm --filter @arbiter/harness run verdict:get -- --id=$ARGUMENTS` を実行。
   - 見つからない場合は前方一致での候補を 5 件まで提示。
3. **整形表示**
   - 以下のフォーマットで出力する:

     ```
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      判決 {id}
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      日時 :   {timestamp}
      申立 :   エージェント「{agentId}」が {tool} を実行しようとした
      対象 :   {intent.extractedContext.targetResource}
      宛先 :   {intent.extractedContext.recipients}

      ⚖️  判決 : {decision}（確信度 {confidence}）

      罪状     : {charge}
      適用法令 : {policyRef}

      証拠:
        - {evidence[0]}
        - {evidence[1]}
        ...

      判決文:
        {judgment}

      審理官の意見:
        - {subAgentOpinions[].agent}: {opinion}（{stance}）
     ```
4. **関連情報**
   - Agent Service Trace の URL（あれば）
   - 判例集（同じ `policyRef` の過去 3 判決）の ID を列挙

## 出力

- 上記フォーマットの整形テキスト
- JSON 全文を展開したい場合は `--json` オプションを併用するよう案内

## 注意

- `verdict-id` が UUID 形式以外なら Cosmos の partition key ヒントを表示。

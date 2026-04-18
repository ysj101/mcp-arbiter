# Arbiter Eval Fixtures

Policy Engine の品質を定量評価するためのシナリオデータセット。

## ディレクトリ構成

```
harness/fixtures/
├─ schema.json               # ケース形式の JSON Schema
├─ policy-engine.v1.json     # ポリシー判定ケース (21 件)
└─ README.md
```

## ケース形式

`schema.json` に準拠した JSON。フィールドは以下の通り。

| field | description |
|---|---|
| `id` | ケース一意 ID (kebab-case 推奨) |
| `input.tool` | MCP ツール名 (例: `send_email`) |
| `input.parameters` | ツール実行パラメータ |
| `expected_decision` | `"allow"` または `"deny"` |
| `rationale` | 判定理由 (人間向けメモ) |
| `tags` | カテゴリタグ (`baseline` / `grey-zone` / `boundary` 等) |

## タグの意味

| tag | 用途 |
|---|---|
| `baseline` | 明らかに allow / deny と判定されるべき基準ケース |
| `grey-zone` | 人間でも判断に迷うが、方針としてどちらかを期待するケース |
| `boundary` | 方針の境界付近 (文脈依存) |
| `deny` / `allow` | 期待結果タグ |
| `hr` / `salary` / `pii` 等 | カテゴリ |

## データ追加手順

1. 新規ケースを `policy-engine.vN.json` の `cases[]` に追加
2. `id` は既存と重複しないように設定
3. `schema.json` と整合しているかを確認
4. `pnpm harness:run` を実行し、期待通りに判定されるか確認
   - 誤判定が出た場合は「プロンプトの問題」か「データセット側の齟齬」かを判断
5. PR で追加理由・想定ユースケースを記載

## Versioning

- 新ラウンドで大量追加・仕様変更する場合は `v2` を切る
- Harness は `policy-engine.v1.json` をデフォルト読込。`--fixtures` 引数で切替可能。

# agent-browser skill（vendored）

このディレクトリの `SKILL.md` は [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser) の `skills/agent-browser/SKILL.md` をそのまま取り込んだものです。リポジトリに直接 commit することで、クローン直後から全メンバーの Claude Code で `agent-browser` スキルが共有されます。

## 取得元

- 元ファイル: https://github.com/vercel-labs/agent-browser/blob/main/skills/agent-browser/SKILL.md
- 取得時点 SHA: `997b66e829df3c45bbea29edf4d33826fbdbdbef`
- ライセンス: Apache License 2.0（https://github.com/vercel-labs/agent-browser/blob/main/LICENSE）

## 編集方針

- **基本は編集しない**。上流の更新をミラーする運用とし、必要に応じて `curl -L <raw URL> -o SKILL.md` で再取得する。
- プロジェクト独自の agent-browser 運用ガイド（インストール手順、法廷メタファ UI レビュー用の使い方など）は、SKILL.md ではなく [.claude/AGENT_BROWSER.md](../../AGENT_BROWSER.md) に書く。
- `agent-browser skills get core` で CLI 側から常に最新ワークフローが取れるため、SKILL.md 本体は「呼び出しトリガーの入口」以上の情報を持たない設計。無理に肉付けしない。

## 前提

- `agent-browser` CLI 本体のインストールが必要: `npm i -g agent-browser && agent-browser install`
- Claude Code の permissions で `Bash(agent-browser:*)` / `Bash(npx agent-browser:*)` が通ること（SKILL.md の `allowed-tools` に宣言済み）

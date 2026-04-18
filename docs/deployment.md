# デプロイ手順（ハッカソン審査員向け限定公開）

MCP Arbiter を Azure Static Web Apps (SWA) + Azure Functions (Proxy) で公開し、**Entra ID で認証された審査員だけがアクセスできる** 状態で提出する手順。構成は [spec.md](./spec.md) §4 / §11.5.2 に準拠。

---

## 1. 全体像

```
[審査員 Browser] ─ (Entra ID sign-in) ─▶ [Azure Static Web Apps]
                                             │ (SSR) ──▶ [Azure Functions (Proxy)]
                                             │              │
                                             │              ▶ [Cosmos DB Serverless]
                                             │              ▶ [Azure SignalR]
                                             ▼
                                        Dashboard (Next.js)
```

Dashboard UI は SWA に乗り、未認証は `/*` ルートで **Entra ID ログインに自動リダイレクト**される（[`packages/dashboard/staticwebapp.config.json`](../packages/dashboard/staticwebapp.config.json)）。

---

## 2. Azure 側の準備

### 2.1 Entra ID アプリ登録

1. Azure Portal → **Microsoft Entra ID** → **App registrations** → **New registration**
2. Name: `mcp-arbiter-dashboard`
3. Redirect URI (Web): `https://<SWA の既定ホスト名>/.auth/login/aad/callback`
4. 登録後、以下を控える:
   - **Application (client) ID** → `AAD_CLIENT_ID`
   - **Directory (tenant) ID** → `AAD_TENANT_ID`（`staticwebapp.config.json` の `openIdIssuer` で使う）
5. **Certificates & secrets** → **New client secret** → 値を控える → `AAD_CLIENT_SECRET`

### 2.2 審査員アカウント

Entra tenant に招待:
- **External Identities → Guest invitations** で審査員のメールアドレスを招待
- もしくは個人 Microsoft アカウントを許可する場合は App registration の `Supported account types` を「Accounts in any organizational directory and personal Microsoft accounts」に切替

> 招待されたゲストだけが SWA にログインできる。未招待者は Entra ID 画面で弾かれる。

### 2.3 Static Web Apps の作成

```bash
az staticwebapp create \
  --name mcp-arbiter-dashboard \
  --resource-group mcp-arbiter-rg \
  --location eastasia \
  --source <GitHub repo URL> \
  --branch main \
  --app-location packages/dashboard \
  --output-location .next \
  --api-location packages/proxy
```

`--api-location` で Functions を linked API として紐付け、**SWA の認証が Functions まで貫通** する（Proxy を外部に露出しない）。

### 2.4 SWA の Application Settings

Portal の **Configuration** で以下を設定:

| Name | Value |
|---|---|
| `AAD_CLIENT_ID` | §2.1 の Application (client) ID |
| `AAD_CLIENT_SECRET` | §2.1 の client secret |
| `ARBITER_SHARED_SECRET` | ランダム英数字（Dashboard → Proxy の内部 Bearer） |
| `ARBITER_PROXY_URL` | linked API の内部 URL（通常は `http://localhost:7071` 相当、SWA linked なら設定不要） |
| `ARBITER_MODE` | `cloud` |
| `COSMOS_ENDPOINT` / `COSMOS_KEY` / `COSMOS_DATABASE` | Cosmos 接続情報 |
| `SIGNALR_CONNECTION_STRING` | SignalR 接続情報 |

> `staticwebapp.config.json` 中の `AAD_TENANT_ID` は SWA の **Configuration** に置くか、config の URL 内を直接 tenant ID に置換する（`staticwebapp.config.json` はビルド時に参照される）。

### 2.5 `staticwebapp.config.json` のテナント ID

リポジトリの `packages/dashboard/staticwebapp.config.json` で以下を実テナント ID に置換:

```diff
- "openIdIssuer": "https://login.microsoftonline.com/AZURE_CLIENT_TENANT_ID/v2.0"
+ "openIdIssuer": "https://login.microsoftonline.com/<AAD_TENANT_ID>/v2.0"
```

Multi-tenant を許可するなら `common` でも可（個人 MS アカウントも通す場合）。

---

## 3. 動作確認

1. SWA の URL (`https://<name>.azurestaticapps.net/`) を開く
2. Entra ID のログイン画面に自動リダイレクトされる
3. 招待された審査員アカウントで sign in
4. Dashboard `/timeline` `/precedents` `/policies` が見られる
5. 未認証の別ブラウザ（プライベートウィンドウ）で試すと、また Entra に飛ばされる

---

## 4. 既知の制限 / TODO

- **Proxy `/invoke` の Entra ID JWT 検証**: 現状 `LocalBearerAuthAdapter` のみ。cloud 用 `EntraIdAuthAdapter.verifyJwt` の実装は別 PR で追加予定。SWA linked API 構成下では外部から Proxy を直接叩けないため、当面は SWA レイヤーの認証だけで運用可能。
- **ゲスト招待 vs Multi-tenant**: 単独 tenant で運用する場合はゲスト招待、複数組織を跨ぐなら Multi-tenant にし `Supported account types` を調整する。

---

## 5. 参考

- [Azure Static Web Apps - Authentication and authorization](https://learn.microsoft.com/azure/static-web-apps/authentication-authorization)
- [spec.md §11.5.2](./spec.md) — 段階的認証戦略

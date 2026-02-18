# ケンカジャッジ

喧嘩仲裁AI（Deepgram + Gemini）を使った Next.js アプリです。

## セットアップ

```bash
npm install
cp .env.example .env.local
# .env.local を編集
npm run dev
```

## 必須環境変数

- `DEEPGRAM_API_KEY`
- `GEMINI_API_KEY`
- `ROOM_PASSWORD`
- `SESSION_SECRET`

## 主なAPI

- `POST /api/auth` パスワード認証
- `GET /api/deepgram-token` Deepgram一時トークン発行
- `POST /api/judge` Geminiで仲裁結果を生成

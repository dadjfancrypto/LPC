# クイックスタートガイド

## ✅ 完了したこと
- Firebase SDKのインストール
- リアルタイム共同編集機能の実装
- エラーハンドリングの追加

## 📝 残りの手順（手動で行う必要があります）

### 1. `.env.local`ファイルの作成

プロジェクトルートに `.env.local` ファイルを作成し、以下の内容をコピー&ペーストしてください：

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAdF_haSqqGtizCxW2AmiYvO1RRrbmqGIQ
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=lpswork-c3e05.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://lpswork-c3e05-default-rtdb.asia-southeast1.firebasedatabase.app
NEXT_PUBLIC_FIREBASE_PROJECT_ID=lpswork-c3e05
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=lpswork-c3e05.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=454183894758
NEXT_PUBLIC_FIREBASE_APP_ID=1:454183894758:web:43d7a09fd0e5cc57020527
```

**詳細**: `SETUP_ENV_LOCAL.txt` を参照してください

### 2. セキュリティルールの設定

1. Firebase Consoleでプロジェクトを選択
2. 左メニューから「Realtime Database」を選択
3. 「Rules」タブをクリック
4. `FIREBASE_SECURITY_RULES.json` の内容をコピー&ペースト
5. 「Publish」をクリック

### 3. 動作確認

1. 開発サーバーを再起動: `npm run dev`
2. ブラウザで `http://localhost:3000/work` にアクセス
3. セッションIDが自動生成される
4. 別のブラウザ/タブで同じURLにアクセスして、リアルタイム同期を確認

## 🎯 使い方

1. `/work` にアクセスすると、自動でセッションIDが生成されます
2. ヘッダーの「セッションID」の横にある「コピー」ボタンをクリック
3. 顧客にURLを共有
4. 顧客が同じURLにアクセスすると、リアルタイムで共同編集できます

## ⚠️ トラブルシューティング

### 接続できない場合
- `.env.local` ファイルが正しく作成されているか確認
- 開発サーバーを再起動
- ブラウザのコンソール（F12）でエラーメッセージを確認

### データが保存されない場合
- セキュリティルールが正しく設定されているか確認
- Firebase Consoleの「Realtime Database」→「Data」タブでデータが表示されるか確認

詳細は `FIREBASE_SETUP.md` を参照してください。


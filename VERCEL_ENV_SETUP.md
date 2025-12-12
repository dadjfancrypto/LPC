# Vercel環境変数の設定方法

## 問題
Vercelにデプロイした瞬間、Firebaseが設定されていないというエラーが表示されます。

## 原因
`.env.local`ファイルはローカル開発環境でのみ有効です。Vercelには環境変数を別途設定する必要があります。

## 解決方法

### 1. Vercelダッシュボードにアクセス
1. [Vercel Dashboard](https://vercel.com/dashboard) にアクセス
2. プロジェクトを選択

### 2. 環境変数の設定
1. プロジェクトの「Settings」タブをクリック
2. 左メニューから「Environment Variables」を選択
3. 以下の環境変数を追加（`.env.local`と同じ値を使用）：

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAdF_haSqqGtizCxW2AmiYvO1RRrbmqGIQ
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=lpswork-c3e05.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://lpswork-c3e05-default-rtdb.asia-southeast1.firebasedatabase.app
NEXT_PUBLIC_FIREBASE_PROJECT_ID=lpswork-c3e05
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=lpswork-c3e05.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=454183894758
NEXT_PUBLIC_FIREBASE_APP_ID=1:454183894758:web:43d7a09fd0e5cc57020527
```

### 3. 環境変数の追加手順
各環境変数について：
1. 「Add New」をクリック
2. 「Key」に環境変数名を入力（例: `NEXT_PUBLIC_FIREBASE_API_KEY`）
3. 「Value」に値を入力（例: `AIzaSyAdF_haSqqGtizCxW2AmiYvO1RRrbmqGIQ`）
4. 「Environment」で適用環境を選択：
   - **Production**: 本番環境
   - **Preview**: プレビュー環境（PRなど）
   - **Development**: 開発環境
   - すべてにチェックを入れることを推奨
5. 「Save」をクリック

### 4. 再デプロイ
環境変数を追加した後：
1. 「Deployments」タブに移動
2. 最新のデプロイメントの「...」メニューをクリック
3. 「Redeploy」を選択
4. または、新しいコミットをプッシュして自動デプロイをトリガー

## 注意事項

- **機密情報の取り扱い**: 環境変数は機密情報です。GitHubにコミットしないでください（`.env.local`は`.gitignore`に含まれています）
- **値の確認**: `.env.local`ファイルの値と一致しているか確認してください
- **NEXT_PUBLIC_プレフィックス**: すべての環境変数は`NEXT_PUBLIC_`で始まる必要があります（クライアント側で使用するため）

## 確認方法

環境変数が正しく設定されているか確認：
1. Vercelダッシュボードの「Environment Variables」で一覧を確認
2. デプロイログでエラーが出ていないか確認
3. 本番環境でワークページにアクセスして、Firebase接続状態を確認


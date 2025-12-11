# Firebase設定ガイド

## 1. Firebaseプロジェクトの作成

1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. Googleアカウントでログイン
3. 「Add project（プロジェクトを追加）」をクリック
4. プロジェクト名を入力（例: `lpswork`）
5. Google Analyticsは必要に応じて有効/無効化
6. 「Create project（プロジェクトを作成）」をクリック

## 2. Realtime Databaseの有効化

1. Firebase Consoleでプロジェクトを選択
2. 左メニューから「Realtime Database」を選択
3. 「Create Database（データベースの作成）」をクリック
4. ロケーションを選択
   - **推奨: Singapore（シンガポール）**（日本から最も近く、レイテンシが低い）
   - United States（米国）（安定性が高いが、レイテンシがやや高い）
   - Belgium（ベルギー）（ヨーロッパ向け）
5. セキュリティルールを「Start in test mode（テストモードで開始）」で開始（後で変更します）
6. 「Enable（有効にする）」をクリック

## 3. Webアプリの登録

1. Firebase Consoleでプロジェクトを選択
2. プロジェクトの設定（⚙️アイコン）をクリック
3. 「Add app（アプリを追加）」→「</> Web」を選択
4. アプリのニックネームを入力（例: `Web App`）
5. 「Also set up Firebase Hosting for this app」はチェック不要
6. 「Register app（アプリを登録）」をクリック
7. 表示された設定情報（`firebaseConfig`）をコピー

**設定情報の例:**
```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "lpswork.firebaseapp.com",
  databaseURL: "https://lpswork-default-rtdb.firebaseio.com",
  projectId: "lpswork",
  storageBucket: "lpswork.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

## 4. 環境変数の設定

1. プロジェクトルート（`survivor-pension-pwa`フォルダ）に `.env.local` ファイルを作成
2. 以下の形式で環境変数を設定（上記の設定情報から値をコピー）：

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=lpswork.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://lpswork-default-rtdb.firebaseio.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=lpswork
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=lpswork.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef
```

**重要**: 
- 値は実際のFirebase Consoleに表示されるものを使用してください
- `NEXT_PUBLIC_` というプレフィックスは必須です
- 引用符（`"`）は不要です

## 5. セキュリティルールの設定

1. Firebase Consoleでプロジェクトを選択
2. 左メニューから「Realtime Database」を選択
3. 「Rules（ルール）」タブをクリック
4. 以下のルールを設定：

```json
{
  "rules": {
    "work": {
      "$sessionId": {
        ".read": true,
        ".write": true,
        "panels": {
          ".read": true,
          ".write": true
        },
        "users": {
          ".read": true,
          ".write": true
        }
      }
    }
  }
}
```

5. 「Publish（公開）」をクリック

**注意**: このルールは誰でも読み書き可能です。本番環境では認証を追加することを推奨します。

## 6. 動作確認

1. 開発サーバーを起動: `npm run dev`
2. ブラウザで `http://localhost:3000/work` にアクセス
3. セッションIDが自動生成される
4. 別のブラウザ/タブで同じURLにアクセスして、リアルタイム同期を確認
   - 一方でパネルを追加すると、もう一方にも即座に表示される
   - パネルを移動すると、リアルタイムで位置が同期される

## トラブルシューティング

### 接続できない場合

1. `.env.local` ファイルがプロジェクトルートに正しく作成されているか確認
2. 環境変数が `NEXT_PUBLIC_` で始まっているか確認
3. 値に引用符（`"`）が含まれていないか確認
4. 開発サーバーを再起動（`.env.local`を変更した場合は必須）
5. Firebase Consoleでデータベースが有効になっているか確認
6. ブラウザのコンソール（F12）でエラーメッセージを確認

### データが保存されない場合

1. セキュリティルールを確認（「Rules」タブで上記のルールが設定されているか）
2. Firebase Consoleの「Realtime Database」→「Data」タブでデータが表示されるか確認
3. ブラウザのコンソール（F12）でエラーを確認
4. ネットワーク接続を確認

### エラーメッセージが表示される場合

**「Can't determine Firebase Database URL」エラー:**
- `.env.local` ファイルが正しく設定されているか確認
- `NEXT_PUBLIC_FIREBASE_DATABASE_URL` が正しく設定されているか確認
- 開発サーバーを再起動

**「Permission denied」エラー:**
- セキュリティルールを確認
- ルールが正しく公開されているか確認

## 補足情報

### 無料プラン（Spark）の制限

- 同時接続数: 100
- データ転送: 1GB/月
- ストレージ: 1GB
- 書き込み: 10万/日

小規模な利用（数人〜数十人）であれば、無料プランで十分です。

### セッションURLの共有方法

1. `/work` にアクセスすると、自動でセッションIDが生成されます
2. ヘッダーの「セッションID」の横にある「コピー」ボタンをクリック
3. 顧客にURLを共有
4. 顧客が同じURLにアクセスすると、リアルタイムで共同編集できます

# .env.localファイルの作成手順

## 方法1: エクスプローラーで作成（推奨）

### 手順

1. **エクスプローラーを開く**
   - `survivor-pension-pwa` フォルダを開く

2. **新しいテキストファイルを作成**
   - フォルダ内で右クリック
   - 「新規作成」→「テキスト ドキュメント」を選択
   - ファイル名を `.env.local` に変更
     - ⚠️ 重要: ファイル名は `.env.local` です（先頭にドットがあります）
     - 拡張子は `.txt` ではなく、拡張子なしです

3. **ファイル名の変更方法**
   - ファイルを右クリック → 「名前の変更」
   - または、ファイルを選択してF2キーを押す
   - ファイル名を `.env.local` に変更
   - 「拡張子を変更すると、ファイルが使えなくなる可能性があります」という警告が出たら「はい」をクリック

4. **ファイルを開いて内容を貼り付け**
   - `.env.local` ファイルを右クリック → 「プログラムから開く」→「メモ帳」
   - 以下の内容をコピー&ペースト：

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAdF_haSqqGtizCxW2AmiYvO1RRrbmqGIQ
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=lpswork-c3e05.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://lpswork-c3e05-default-rtdb.asia-southeast1.firebasedatabase.app
NEXT_PUBLIC_FIREBASE_PROJECT_ID=lpswork-c3e05
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=lpswork-c3e05.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=454183894758
NEXT_PUBLIC_FIREBASE_APP_ID=1:454183894758:web:43d7a09fd0e5cc57020527
```

5. **保存**
   - Ctrl + S で保存
   - または、「ファイル」→「上書き保存」

## 方法2: PowerShellで作成

### 手順

1. **PowerShellを開く**
   - `survivor-pension-pwa` フォルダで右クリック
   - 「ターミナルで開く」または「PowerShellで開く」を選択

2. **以下のコマンドを実行**

```powershell
@"
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAdF_haSqqGtizCxW2AmiYvO1RRrbmqGIQ
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=lpswork-c3e05.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://lpswork-c3e05-default-rtdb.asia-southeast1.firebasedatabase.app
NEXT_PUBLIC_FIREBASE_PROJECT_ID=lpswork-c3e05
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=lpswork-c3e05.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=454183894758
NEXT_PUBLIC_FIREBASE_APP_ID=1:454183894758:web:43d7a09fd0e5cc57020527
"@ | Out-File -FilePath .env.local -Encoding utf8
```

3. **ファイルが作成されたか確認**

```powershell
Get-Content .env.local
```

## 方法3: VS Codeで作成

### 手順

1. **VS Codeでプロジェクトを開く**
   - `survivor-pension-pwa` フォルダをVS Codeで開く

2. **新しいファイルを作成**
   - 左側のエクスプローラーで右クリック
   - 「新しいファイル」を選択
   - ファイル名を `.env.local` と入力

3. **内容を貼り付け**
   - 以下の内容をコピー&ペースト：

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAdF_haSqqGtizCxW2AmiYvO1RRrbmqGIQ
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=lpswork-c3e05.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://lpswork-c3e05-default-rtdb.asia-southeast1.firebasedatabase.app
NEXT_PUBLIC_FIREBASE_PROJECT_ID=lpswork-c3e05
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=lpswork-c3e05.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=454183894758
NEXT_PUBLIC_FIREBASE_APP_ID=1:454183894758:web:43d7a09fd0e5cc57020527
```

4. **保存**
   - Ctrl + S で保存

## ⚠️ 重要な注意事項

1. **ファイル名は正確に**
   - `.env.local` （先頭にドット、拡張子なし）
   - `.env.local.txt` ではない
   - `env.local` でもない

2. **引用符は不要**
   - 値に引用符（`"`）を付けないでください
   - 例: `NEXT_PUBLIC_FIREBASE_API_KEY="AIza..."` ❌
   - 正: `NEXT_PUBLIC_FIREBASE_API_KEY=AIza...` ✅

3. **スペースに注意**
   - `=` の前後にスペースを入れないでください
   - 例: `NEXT_PUBLIC_FIREBASE_API_KEY = AIza...` ❌
   - 正: `NEXT_PUBLIC_FIREBASE_API_KEY=AIza...` ✅

4. **ファイルの場所**
   - プロジェクトルート（`survivor-pension-pwa`フォルダ）に作成
   - `package.json` と同じ階層

## ✅ 作成後の確認

1. **ファイルが存在するか確認**
   ```powershell
   Test-Path .env.local
   ```
   `True` と表示されればOK

2. **内容を確認**
   ```powershell
   Get-Content .env.local
   ```
   7行の環境変数が表示されればOK

3. **開発サーバーを再起動**
   - `.env.local` を変更した場合は、必ず開発サーバーを再起動してください
   - `npm run dev` を停止して、再度起動

## 🎯 次のステップ

`.env.local` ファイルを作成したら：

1. 開発サーバーを再起動: `npm run dev`
2. ブラウザで `http://localhost:3000/work` にアクセス
3. Firebase Consoleでセキュリティルールを設定（`FIREBASE_SETUP.md`参照）


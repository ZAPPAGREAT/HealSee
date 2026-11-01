# カロリー収支トラッカー（Next.js / Vercel対応）

## 必要な環境
- Node.js 20.9 以上
- npm

## ローカルで起動
```bash
npm install
npm run dev
```
ブラウザで http://localhost:3000 を開く。

## 本番ビルドの確認
```bash
npm run build
npm start
```

## Vercelへのデプロイ
1. ZIPを展開し、プロジェクト一式をGitHubの新しいリポジトリにpush。
2. Vercelにログインし「Add New → Project」からそのリポジトリをImport。
3. Framework PresetはNext.js、Build Commandは `npm run build`（通常は自動検出）。
4. Environment Variablesは不要。Deployを実行。

## 主な機能
- 開始日を指定して7日分の日付・曜日を自動生成
- 日別の摂取・消費カロリーと収支を自動計算
- 週ごとの保存、読み込み、編集、削除
- 週間・全期間の累計集計
- テキスト、TSVコピー、CSV出力、Excel（.xlsx）出力
- 全週まとめての出力

## 保存について
データはブラウザの `localStorage` に保存されます。サーバーやアカウントには保存されず、同じブラウザ内で利用する設計です。別端末との同期、ログイン、複数人利用を実現するには、Supabase等のデータベースと認証を追加してください。ブラウザデータを消す前にCSV/Excelでバックアップしてください。

## 補足
Excel出力には `xlsx` パッケージを使用しています。Vercelへのデプロイ時に `npm install` が実行されます。
# HealSee

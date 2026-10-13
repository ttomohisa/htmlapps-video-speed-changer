# Video Speed Changer / 動画速度変更

[![GitHub Pages](https://github.com/ttomohisa/htmlapps-video-speed-changer/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/ttomohisa/htmlapps-video-speed-changer/actions/workflows/deploy-pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[English README](README.md)

動画の速度を0.25〜4.00倍で変更し、変換後の長さを確認してMP4として保存する、ブラウザー内で処理するアプリです。v1.1.0では標準のシングルスレッド（ST）版とマルチスレッド（MT）版を別々に配布します。

[標準ST版を開く](https://ttomohisa.github.io/htmlapps-video-speed-changer/) · [ホストされたMT版を開く](https://ttomohisa.github.io/htmlapps-video-speed-changer/mt/)

[![Video Speed Changerの画面](assets/screenshot.png)](https://ttomohisa.github.io/htmlapps-video-speed-changer/)

## 主な機能

- スライダーや数値で速度を指定し、変換後の長さをすぐ確認
- 目標時間から速度を逆算。入力できる1秒単位の範囲を表示し、パネルを開くだけでは速度を変更しない
- 元動画を指定速度でプレビューし、変換後のMP4も保存前に確認
- 音程を保つ／速度に合わせて音程を変える／音声を削除、の3種類
- 高画質／標準／ファイルを小さく、の画質設定と保存ファイル名の編集
- 変換キャンセル。再変換のキャンセルや失敗時は前の結果と対応する自動ファイル名を保持し、編集した名前も維持
- 日本語／英語UI。FFmpeg JS/WASMとWorkerを内包し、動画は端末内で処理

## 使い方

1. 標準ST版、または分離環境に対応するホスト上のMT版を開きます。
2. 動画を1本選ぶか、ドラッグ＆ドロップします。
3. 0.25×〜4.00×の速度を設定します。**目標時間から決める**では、入力できる範囲を確認して時間を編集します。最初に表示する値は丸めた目安です。
4. 音声の扱いと、必要に応じて**詳細設定**の画質を選びます。
5. ファイル名を確認し、**この設定で動画を変換**を選びます。
6. 結果の動画・長さ・ファイルサイズを確認し、**MP4を保存**を選びます。

標準の動画プレビューが使えなくても、内蔵FFmpegで情報を読み取れれば変換を試せます。すべてのCodecや壊れた動画への対応を保証するものではありません。

**変換をキャンセル**すると実行中のWorkerを停止し、選択動画と設定を保持します。前の結果は新しい変換が成功するか入力動画を変更するまで保存できます。別のアプリURLへ移動しても、選択動画や変換結果は自動で引き継がれません。

## プライバシーとローカル処理

選択動画をアップロードしません。FFmpeg、WASM、pthread Workerは各HTMLに内包します。実行時CDN、解析・追跡、外部フォント、API、自動更新確認はなく、CSPは `connect-src 'none'` を維持します。

Web版では最初のHTML取得が必要です。GitHub PagesのMTラッパーでは、同一オリジンの固定済み `./coi-serviceworker.js` を追加で読み込み、`/mt/` 内に登録して分離のため再読み込みすることがあります。この補助スクリプトは応答ヘッダーを補い、動画をアップロードしません。アプリ全体をオフライン用にキャッシュする仕組みではありません。サーバー側のヘッダーで既に分離されていれば補助スクリプトを読み込みません。配布用の生の単一HTMLには補助スクリプトへの参照を含めません。

Builder Releaseの取得はビルド時だけで、アプリ利用時の通信とは別です。

## 対応ブラウザー・端末

主な対象は最新Chrome／Edgeです。変換にはWebAssembly、Worker、Blob URL、`DecompressionStream`を使います。標準プレビューはブラウザーのCodec対応に依存します。SafariやFirefoxでは機能や使用可能メモリが異なる場合があります。

MTは安全なホスト環境に加え、`crossOriginIsolated === true` と `SharedArrayBuffer` が必要です。条件を満たさない場合は理由を表示し、変換とFFmpegによる情報取得を無効にします。標準ST版を利用できますが、勝手にST実行へ切り替えたり外部からruntimeを取得したりしません。

MTの設定はpthread pool 8、動画デコード2、H.264エンコード4、x264 lookahead 1です。音声Codecとfiltergraphは1スレッドを維持します。速度は動画・端末・ブラウザーによって変わり、必ず速くなるとは限りません。メモリ使用量が増える場合があります。

## 制限事項

- 出力は専用profileによるH.264/AACのMP4です。
- トリミング、クロップ、字幕、トランジション、速度ランプは含みません。
- 長時間・高解像度・大容量動画では端末やブラウザーのメモリ上限に達する場合があります。
- 音程維持を含め、速度プレビューと最終出力にわずかな差が出る場合があります。
- MTは `file://` から直接使えず、分離ヘッダーまたはホストされたPages補助機能が必要です。

## 単一HTMLとオフライン

- ST: `video-speed-changer.html` / `dist/index.html` と `dist/index.self-extract.html`。ファイル取得後はネットワークを切って `file://` で直接開けます。
- MT: `video-speed-changer.mt.html` / `dist/index.mt.html` と `dist/index.mt.self-extract.html`。処理に必要な資産は内包しますが、分離されたHTTP(S)環境から配信する必要があります。HTML自身で応答ヘッダーは設定できません。
- self-extract版は内蔵gzipを展開し、対応する通常版HTMLをバイト単位で復元します。

GitHub Pages、Cloudflareプレビュー、Browser Kittyへの組み込み手順は [MT配信ガイド](docs/MULTI_THREAD_DEPLOYMENT.md) を、公開前の確認は [VERIFY_OFFLINE.md](VERIFY_OFFLINE.md) を参照してください。

## 開発・ビルド

Windowsで `build-standalone.bat` を実行します。通常ビルドにはPowerShell、全リポジトリ検証にはNode.js 24が必要です。

```powershell
./scripts/check-repository.ps1
```

ST／MTともにFFmpeg WASM Builder **v1.10.6** の `video-speed-changer` profileを使用します。`ffmpeg.release.json` と `ffmpeg.release.lock.json` でReleaseを固定し、Assetのbyte数・SHA-256と両variantを検証してから内包します。通常ビルドはルートの両配布HTMLも更新します。出力先を指定したビルドでは更新しません。

```text
src/index.template.html               編集するアプリソース
ffmpeg.release.json / .lock.json       Builder Releaseと検証済み固定情報
build-standalone.ps1 / .bat            ST・MTの両方を生成
scripts/check-repository.ps1          共通のビルド・成果物・回帰検証
scripts/prepare-pages.ps1             生の配布HTMLを変えずpages-distへ配置
dist/index[.mt].html                  通常のST／MT単一HTML
dist/index[.mt].self-extract.html      ST／MT自己展開HTML
dist/dependency-manifest[.mt].json     variantごとのruntime・provenance
dist/self-extract-manifest[.mt].json   variantごとの復元manifest
dist/build-size-report[.mt].json       variantごとのサイズ報告
pages-dist/index.html                 STの公開入口
pages-dist/mt/index.html               MT用ラッパー
pages-dist/mt/index.mt.html            変更していないMT単一HTML
```

Builderを更新するときは、`ffmpeg.release.json` を変更し、`pin-ffmpeg-release.bat` でRelease情報・digest・profileの検証結果を確認してからlockをコミットし再ビルドします。`latest` や検証を回避するhashの手修正は使いません。`build-with-local-ffmpeg.bat <builder-root>` はBuilder開発専用で、`local-builder` provenanceは正式リリース検証を通りません。

PR検証、GitHub Pages、Cloudflare PRプレビューはすべてNode 24で共通のリポジトリ検証を実行します。Pagesの公開対象は `pages-dist/` です。Cloudflareでは `/mt/*` だけに分離ヘッダーを付け、Chromiumで正確なMT URLの分離状態を確認します。プレビューには既存のCloudflare secretsが必要です。PRを閉じた際の削除処理は独立しています。Pagesを有効にするには **Settings → Pages → Source → GitHub Actions** を選びます。

Node状態テストは実際のアプリスクリプトを合成DOM・動画情報・runtime代替で実行します。キャンセル、入力と結果の対応、古い非同期結果、目標時間を各配布版で確認します。配信テストは本物の配置スクリプトとCDP検証コードを制御されたfixtureで実行します。実動画、実ブラウザー、端末、通信の確認は別途必要です。[REGRESSION.md](REGRESSION.md) を参照してください。

## ライセンスと依存物

アプリソースは [MIT](LICENSE)、内包するFFmpeg/x264のST／MTバイナリはGPL-2.0-or-laterです。Builder v1.10.6の対応ソースに関する条件を維持します。Pages補助スクリプトはcoi-serviceworker 0.1.7（MIT）をcommitとSHA-256で固定しています。詳しくは [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) を参照してください。

Copyright © 2026 ttomohisa。バグ報告・提案はGitHub Issuesへ。[CONTRIBUTING.md](CONTRIBUTING.md) も参照してください。

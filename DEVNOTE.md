# Build & Release

## Supported platforms

| Platform | Status |
|---|---|
| Linux | ✅ |
| Windows | ✅ |
| macOS | ❌ |

## Local build

```bash
bun install
bun run build:prod
```

Output goes to `build/`.

## CI

### Build (`.github/workflows/build.yml`)

- トリガー: `main` ブランチへの push / PR
- Ubuntu + Windows で matrix build
- 成果物は Actions Artifacts に保存 (90日間)

### Release (`.github/workflows/release.yml`)

- トリガー: `v*` タグの push (`git tag v1.0.0 && git push origin v1.0.0`)
- Ubuntu + Windows で build → GitHub Release を作成し、両プラットフォームのバイナリを添付
- Release notes は自動生成
- `contents: write` 権限で Release を作成

## Updater

`electrobun.config.ts` の `release.baseUrl` が GitHub Releases を指している。
`Updater` API でアプリ内更新確認が可能。

## アイコン

- Linux: `assets/icon.png`
- Windows: `assets/icon.ico` (PNG から ImageMagick で変換)

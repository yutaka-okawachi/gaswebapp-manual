# UTF-8エンコーディング問題の修正

## 🔴 問題

GitHubにプッシュされたJSONファイルで、ウムラウト（ä, ö, ü）や日本語が「?」に文字化けしていました。

![文字化けの例](C:/Users/okawa/.gemini/antigravity/brain/6cd43a9a-2937-47cb-8548-c613ad2b48d4/uploaded_image_1764825358268.png)

---

## 🔍 原因

`Utilities.base64Encode(jsonString)` が文字列をそのままBase64エンコードしていたため、UTF-8として正しく処理されませんでした。

---

## ✅ 修正内容

### github_sync.js（63-70行目）

**Before:**
```javascript
// JSONを文字列化してBase64エンコード
const jsonString = JSON.stringify(content, null, 2);
const base64Content = Utilities.base64Encode(jsonString);
```

**After:**
```javascript
// JSONを文字列化してUTF-8でBase64エンコード
const jsonString = JSON.stringify(content, null, 2);

// UTF-8として正しくエンコードするためにBlobを使用
const blob = Utilities.newBlob(jsonString, 'application/json; charset=utf-8');
const base64Content = Utilities.base64Encode(blob.getBytes());
```

### 変更点

1. **Blobオブジェクトを作成**: `Utilities.newBlob()` で明示的にUTF-8エンコーディングを指定
2. **バイト配列を取得**: `blob.getBytes()` でUTF-8バイト列を取得
3. **Base64エンコード**: バイト列を正しくBase64化

これにより、ウムラウトや日本語などのマルチバイト文字が正しく処理されます。

---

## 🚀 次のステップ

1. **GASエディタをリロード**（F5）
2. **exportAllDataToJson()** を再実行
3. GitHubのファイルを確認

### テストケース確認

以下の文字が正しく表示されることを確認してください：
- **ウムラウト**: ä, ö, ü, ß
- **日本語**: 日本語訳が正しく表示
- **その他の特殊文字**: é, è, ñ など

---

## 📝 技術詳細

### なぜBlobを使うのか？

JavaScriptの文字列は内部的にUTF-16ですが、GitHub APIはUTF-8を期待します。

| 方法 | 結果 |
|------|------|
| `base64Encode(string)` | ❌ 文字化け（バイト不一致） |
| `base64Encode(blob.getBytes())` | ✅ 正しい（UTF-8バイト列） |

### GASのBlob処理

`Utilities.newBlob(data, contentType)` は：
1. データをUTF-8でエンコード
2. 指定されたMIMEタイプを設定
3. バイト配列として取得可能にする

---

## ✅ 検証

修正後、以下を確認してください：

### 1. テストデータで確認

GASで実行：
```javascript
function testUTF8Encoding() {
  const testData = {
    german: 'Über, Größe, Fähigkeit',
    japanese: 'データベース、日本語訳',
    mixed: 'äöüß 日本語 éèñ'
  };
  
  const files = {
    'test/utf8_test.json': testData
  };
  
  pushToGitHub(files, 'テスト: UTF-8エンコーディング確認');
}
```

### 2. GitHub上で確認

`test/utf8_test.json` を開いて、すべての文字が正しく表示されていることを確認。

### 3. 本番データで確認

`exportAllDataToJson()` を実行後、`mahler.json` などで日本語とウムラウトを確認。

---

## 🎉 完了

この修正により、すべてのマルチバイト文字が正しく処理されます！

# Git蜷梧悄繝ｯ繝ｼ繧ｯ繝輔Ο繝ｼ

GAS縺ｮ閾ｪ蜍墓峩譁ｰ縺ｨ繝ｭ繝ｼ繧ｫ繝ｫ邱ｨ髮・ｒ繧ｹ繝繝ｼ繧ｺ縺ｫ蜷梧悄縺吶ｋ縺溘ａ縺ｮ繧ｬ繧､繝峨〒縺吶・

## 閭梧勹

縺薙・繝励Ο繧ｸ繧ｧ繧ｯ繝医〒縺ｯ2縺､縺ｮ譖ｴ譁ｰ邨瑚ｷｯ縺後≠繧翫∪縺・

1. **GAS 竊・GitHub**: `exportAllDataToJson`縺ｧJSON繝輔ぃ繧､繝ｫ縺ｨHTML繧定・蜍墓峩譁ｰ
2. **繝ｭ繝ｼ繧ｫ繝ｫ 竊・GitHub**: HTML/CSS縺ｪ縺ｩ繧偵Ο繝ｼ繧ｫ繝ｫ縺ｧ邱ｨ髮・＠縺ｦpush

## 繧ｳ繝ｳ繝輔Μ繧ｯ繝医ｒ髦ｲ縺先婿豕・

### 笨・謗ｨ螂ｨ繝ｯ繝ｼ繧ｯ繝輔Ο繝ｼ

繝ｭ繝ｼ繧ｫ繝ｫ縺ｧ邱ｨ髮・＠縺ｦpush縺吶ｋ蜑阪↓縲・*蠢・★繝ｪ繝｢繝ｼ繝医・螟画峩繧貞叙繧願ｾｼ繧**:

```powershell
# /push繧ｳ繝槭Φ繝峨ｒ菴ｿ縺・ｼ域耳螂ｨ・・
/push
```

繧ｨ繝ｼ繧ｸ繧ｧ繝ｳ繝医′閾ｪ蜍慕噪縺ｫ莉･荳九ｒ螳溯｡後＠縺ｾ縺・
1. `git pull --rebase` (繝ｪ繝｢繝ｼ繝医・螟画峩繧貞叙蠕・
2. `git add .` (螟画峩繧偵せ繝・・繧ｸ繝ｳ繧ｰ)
3. `git commit` (繧ｳ繝溘ャ繝・
4. `git push` (繝励ャ繧ｷ繝･)

### 謇句虚縺ｧ螳溯｡後☆繧句ｴ蜷・

```powershell
# 1. 繝ｪ繝｢繝ｼ繝医・螟画峩繧貞叙繧願ｾｼ繧
git pull --rebase

# 2. 螟画峩繧堤｢ｺ隱・
git status

# 3. 螟画峩繧偵せ繝・・繧ｸ繝ｳ繧ｰ
git add .

# 4. 繧ｳ繝溘ャ繝・
git commit -m "HTML繧呈峩譁ｰ"

# 5. 繝励ャ繧ｷ繝･
git push
```

## `git pull --rebase`縺ｨ縺ｯ・・

- **`git pull`**: 繝ｪ繝｢繝ｼ繝医・螟画峩繧偵Ο繝ｼ繧ｫ繝ｫ縺ｫ邨ｱ蜷・
- **`--rebase`**: 繝槭・繧ｸ繧ｳ繝溘ャ繝医ｒ菴懊ｉ縺壹√Ο繝ｼ繧ｫ繝ｫ縺ｮ螟画峩繧偵Μ繝｢繝ｼ繝医・譛譁ｰ縺ｮ荳翫↓縲御ｹ励○繧九・
  - 螻･豁ｴ縺後″繧後＞縺ｫ縺ｪ繧・
  - 繧ｳ繝ｳ繝輔Μ繧ｯ繝医′襍ｷ縺阪↓縺上＞

## 繧ｳ繝ｳ繝輔Μ繧ｯ繝医′逋ｺ逕溘＠縺溷ｴ蜷・

繧ゅ＠繧ｳ繝ｳ繝輔Μ繧ｯ繝医′逋ｺ逕溘＠縺溷ｴ蜷・

```powershell
# 1. 繧ｳ繝ｳ繝輔Μ繧ｯ繝医＠縺ｦ縺・ｋ繝輔ぃ繧､繝ｫ繧堤｢ｺ隱・
git status

# 2. 繝輔ぃ繧､繝ｫ繧呈焔蜍輔〒邱ｨ髮・＠縺ｦ繧ｳ繝ｳ繝輔Μ繧ｯ繝医ｒ隗｣豎ｺ

# 3. 隗｣豎ｺ蠕後∫ｶ夊｡・
git add <繝輔ぃ繧､繝ｫ蜷・
git rebase --continue

# 4. 繝励ャ繧ｷ繝･
git push
```

### 繧医￥縺ゅｋ繧ｱ繝ｼ繧ｹ

**繧ｷ繝翫Μ繧ｪ**: GAS縺ｧJSON繧呈峩譁ｰ蠕後√Ο繝ｼ繧ｫ繝ｫ縺ｧHTML繧堤ｷｨ髮・＠縺ｦpush

笶・**隱､縺｣縺滓焔鬆・* (繧ｳ繝ｳ繝輔Μ繧ｯ繝育匱逕・:
```powershell
git add .
git commit -m "HTML譖ｴ譁ｰ"
git push  # 竊・繧ｨ繝ｩ繝ｼ・√Μ繝｢繝ｼ繝医′蜈医↓騾ｲ繧薙〒縺・ｋ
```

笨・**豁｣縺励＞謇矩・*:
```powershell
git pull --rebase  # 竊・蜈医↓繝ｪ繝｢繝ｼ繝医ｒ蜿門ｾ・
git add .
git commit -m "HTML譖ｴ譁ｰ"
git push  # 竊・謌仙粥・・
```

## Tips

- **GAS縺ｧ譖ｴ譁ｰ縺励◆逶ｴ蠕・*: 繝ｭ繝ｼ繧ｫ繝ｫ縺ｧ菴懈･ｭ縺吶ｋ蜑阪↓`git pull`繧貞ｮ溯｡・
- **邱ｨ髮・ｸｭ縺ｫ荳榊ｮ峨↑蝣ｴ蜷・*: `git fetch`縺ｧ繝ｪ繝｢繝ｼ繝医・迥ｶ諷九ｒ遒ｺ隱・
- **`/push`繧ｳ繝槭Φ繝・*: 蟶ｸ縺ｫ縺薙・繧ｳ繝槭Φ繝峨ｒ菴ｿ縺医・閾ｪ蜍慕噪縺ｫ螳牙・

## 繝輔ぃ繧､繝ｫ邂｡逅・・蜴溷援

### GAS縺檎ｮ｡逅・☆繧九ヵ繧｡繧､繝ｫ・育峩謗･邱ｨ髮・＠縺ｪ縺・ｼ・

| 繝輔ぃ繧､繝ｫ | 邂｡逅・婿豕・| 邱ｨ髮・＠縺溘＞蝣ｴ蜷・|
|---------|---------|---------------|
| `mahler-search-app/dic.html` | GAS縺瑚・蜍慕函謌・| `/dic-layout`縺ｧ`generate_dic_html.js`繧堤ｷｨ髮・|
| `mahler-search-app/data/*.json` | GAS縺後お繧ｯ繧ｹ繝昴・繝・| 繧ｹ繝励Ξ繝・ラ繧ｷ繝ｼ繝育ｵ檎罰縺ｧ邱ｨ髮・|

### 繝ｭ繝ｼ繧ｫ繝ｫ縺ｧ邂｡逅・☆繧九ヵ繧｡繧､繝ｫ・郁・逕ｱ縺ｫ邱ｨ髮・庄・・

- `index.html`
- `richard_strauss.html`
- `richard_wagner.html`
- `notes.html`
- `app.js`
- `styles.css`
- 縺昴・莉悶・HTML/CSS/JS

### 圷 dic.html縺ｧ迚ｹ蛻･縺ｪ豕ｨ諢・

`dic.html`縺ｯGAS縺ｧ閾ｪ蜍慕函謌舌＆繧後ｋ縺溘ａ縲・*繝ｭ繝ｼ繧ｫ繝ｫ縺ｧ逶ｴ謗･邱ｨ髮・☆繧九→荳頑嶌縺阪＆繧後∪縺・*縲・

#### 繧ｳ繝ｳ繝輔Μ繧ｯ繝医′逋ｺ逕溘＠縺溷ｴ蜷・

```powershell
# GAS迚医ｒ蜆ｪ蜈茨ｼ域耳螂ｨ・・
git checkout --theirs mahler-search-app/dic.html
git add mahler-search-app/dic.html
git rebase --continue
git push
```

#### 繝ｬ繧､繧｢繧ｦ繝亥､画峩縺励◆縺・ｴ蜷・

`/dic-layout`繝ｯ繝ｼ繧ｯ繝輔Ο繝ｼ繧剃ｽｿ逕ｨ縺励※縺上□縺輔＞:

1. `src/generate_dic_html.js`繧堤ｷｨ髮・
2. `clasp push`縺ｧGAS縺ｫ繧｢繝・・繝ｭ繝ｼ繝・
3. GAS縺ｧ`exportAllDataToJson`繧貞ｮ溯｡・
4. `git pull`縺ｧ蜿門ｾ・

隧ｳ邏ｰ縺ｯ[DIC_LAYOUT_CHANGE_GUIDE.md](file:///c:/Users/okawa/gaswebapp-manual/DIC_LAYOUT_CHANGE_GUIDE.md)繧貞盾辣ｧ縲・

## 縺ｾ縺ｨ繧・

> [!TIP]
> **蟶ｸ縺ｫ`/push`繧ｳ繝槭Φ繝峨ｒ菴ｿ縺・*縺薙→縺ｧ縲√さ繝ｳ繝輔Μ繧ｯ繝医ｒ閾ｪ蜍慕噪縺ｫ髦ｲ縺偵∪縺呻ｼ・
> 
> dic.html縺ｮ繝ｬ繧､繧｢繧ｦ繝亥､画峩縺ｯ`/dic-layout`繧剃ｽｿ逕ｨ縺励※縺上□縺輔＞縲・



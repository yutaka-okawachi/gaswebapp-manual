#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
dic_experimental.htmlに用語IDを追加するスクリプト
"""

import re
import json

def normalize_german(text):
    """ドイツ語をURL対応形式に正規化（GAS側の normalizeForId と統一）"""
    text = text.lower()
    text = text.replace('ä', 'ae').replace('ö', 'oe').replace('ü', 'ue').replace('ß', 'ss')
    # スペースをハイフンに置換
    text = text.replace(' ', '-')
    # 英数字とハイフンのみ残し、他を削除
    text = re.sub(r'[^a-z0-9\-]', '', text)
    # 連続するハイフンを1つに
    text = re.sub(r'-+', '-', text)
    return text.strip('-')

def add_term_ids(input_file, output_file, index_file):
    """HTMLファイルに用語IDを追加"""
    
    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    term_index = {}
    
    # <div class="row">または<div class="row" id="letter-X">のパターン
    pattern = r'(<div class="row"(?:\s+id="[^"]*")?>\s*<div>\s*<span class="german">)([^<]+)(</span>)'
    
    def replace_func(match):
        prefix = match.group(1)
        german_text = match.group(2)
        suffix = match.group(3)
        
        # 前後の空白を除去
        german_text = german_text.strip()
        
        # 正規化してIDを生成
        normalized = normalize_german(german_text)
        term_id = f"term-{normalized}"  # 正規化された形式を使用
        
        # インデックスに追加
        term_index[normalized] = term_id
        
        # IDが既に存在しない場合のみ追加
        if 'data-term-id=' not in prefix and 'id="term-' not in prefix:
            # <div class="row">に data-term-id を追加
            new_div = prefix.replace('<div class="row"', f'<div class="row" data-term-id="{term_id}"')
            return new_div + german_text + suffix
        else:
            return match.group(0)
    
    # 置換実行
    new_content = re.sub(pattern, replace_func, content)
    
    # CSSの挿入
    highlight_css = """
        /* ハッシュリンクで飛んできた時のハイライト */
        .row.highlight {
            background-color: #ffffcc;
            transition: background-color 0.5s ease;
        }
    """
    if '</style>' in new_content:
        new_content = new_content.replace('</style>', highlight_css + '</style>')
    
    # JavaScriptの挿入
    hash_handler_js = """
            // 用語へのリンク（#term-XXX）
            if (hash.startsWith('#term-')) {
                // ブラウザによるエンコードを防ぐために decodeURIComponent を使用
                const termId = decodeURIComponent(hash.substring(1));
                let targetElement = document.querySelector(`[data-term-id="${termId}"]`);
                
                if (targetElement) {
                    // 以前のハイライトをクリア
                    document.querySelectorAll('.row.highlight').forEach(el => {
                        el.classList.remove('highlight');
                    });
                    
                    // ハイライトを追加
                    targetElement.classList.add('highlight');
                    targetElement.scrollIntoView({ behavior: 'auto', block: 'start' });
                    
                    // 3秒後にハイライトを解除
                    setTimeout(() => {
                        targetElement.classList.remove('highlight');
                    }, 3000);
                }
                return;
            }
    """
    if '// 略記一覧へのリンク' in new_content:
        new_content = new_content.replace('// 略記一覧へのリンク', hash_handler_js + '            // 略記一覧へのリンク')
    
    # ファイルを保存
    with open(output_file, 'w', encoding='utf-8', newline='\r\n') as f:
        f.write(new_content)
    
    # インデックスをJSON形式で保存
    with open(index_file, 'w', encoding='utf-8') as f:
        json.dump(term_index, f, ensure_ascii=False, indent=2)
    
    print(f"✓ {output_file} を作成しました")
    print(f"✓ {index_file} を作成しました（{len(term_index)}件の用語）")

if __name__ == '__main__':
    add_term_ids(
        'mahler-search-app/dic.html',
        'mahler-search-app/dic_experimental.html',
        'mahler-search-app/data/dic_terms_index.json'
    )

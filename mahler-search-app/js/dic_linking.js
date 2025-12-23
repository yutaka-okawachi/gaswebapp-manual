/**
 * dic_linking.js
 * 
 * 用語集リンク機能（実験版）
 * 
 * dic.html以外のページで表示されるドイツ語原文から、dic.htmlの該当見出し語へ
 * 直接ジャンプできるリンクを付与する実験的機能
 * 
 * 重要な設計方針：
 * - 既存のapp.jsやmahler.jsには一切手を加えない
 * - 検索結果表示後に、後からリンクを付与する（検索機能の邪魔をしない）
 * - エラーが発生しても既存機能には影響しない（try-catchで保護）
 */

(function() {
    'use strict';
    
    // 用語インデックスをグローバルに保持
    window.dicTermsIndex = null;
    window.dicLinkingEnabled = false;
    
    /**
     * 用語インデックスを読み込む
     * ページ読み込み時に一度だけ実行
     */
    function initDicLinking() {
        if (window.dicTermsIndex) {
            console.log('[DicLinking] Already initialized');
            return Promise.resolve(window.dicTermsIndex);
        }
        
        console.log('[DicLinking] Loading term index...');
        
        return fetch('data/dic_terms_index.json')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                window.dicTermsIndex = data;
                window.dicLinkingEnabled = true;
                console.log(`[DicLinking] Loaded ${Object.keys(data).length} terms`);
                return data;
            })
            .catch(error => {
                console.warn('[DicLinking] Failed to load term index:', error);
                window.dicLinkingEnabled = false;
                return null;
            });
    }
    
    /**
     * ドイツ語のウムラウトと特殊文字を正規化（小文字変換）
     * 用語インデックスとの照合用
     */
    function normalizeGerman(text) {
        if (!text || typeof text !== 'string') return '';
        
        return text
            .toLowerCase()
            .replace(/ä/g, 'ae')
            .replace(/ö/g, 'oe')
            .replace(/ü/g, 'ue')
            .replace(/ß/g, 'ss')
            .trim();
    }
    
    /**
     * 単一のドイツ語テキストをリンク化する
     * 
     * @param {string} text - ドイツ語テキスト
     * @return {string} リンク化されたHTML（該当する場合）または元のテキスト
     */
    function linkGermanTextToDic(text) {
        if (!text || !window.dicLinkingEnabled || !window.dicTermsIndex) {
            return text;
        }
        
        // 半角スペースを含む場合はリンク化しない（長い文章を除外）
        if (text.includes(' ')) {
            return text;
        }
        
        // 用語インデックスと照合（小文字で）
        const normalizedText = normalizeGerman(text);
        const termId = window.dicTermsIndex[normalizedText];
        
        if (termId) {
            // リンクを作成
            return `<a href="dic_experimental.html#${termId}" title="用語集で確認" class="dic-link">${escapeHtml(text)}</a>`;
        }
        
        return escapeHtml(text);
    }
    
    /**
     * HTMLエスケープ
     */
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
    
    /**
     * ページ内のドイツ語部分にリンクを適用
     * 
     * 対象：.result-a クラス（ドイツ語原文）のテキストノードのみ
     * 
     * 注意：既存のDOM構造は変更せず、テキストノードのみを置換する
     */
    function applyDicLinksToPage() {
        if (!window.dicLinkingEnabled || !window.dicTermsIndex) {
            console.log('[DicLinking] Not enabled or index not loaded');
            return;
        }
        
        try {
            console.log('[DicLinking] Applying links to page...');
            
            // .result-a クラスの要素を取得（ドイツ語原文）
            const germanElements = document.querySelectorAll('.result-a');
            
            if (germanElements.length === 0) {
                console.log('[DicLinking] No .result-a elements found');
                return;
            }
            
            let linksApplied = 0;
            
            germanElements.forEach(element => {
                // 既にリンクが適用されている場合はスキップ
                if (element.querySelector('.dic-link')) {
                    return;
                }
                
                // テキストノードのみを処理
                const textContent = element.textContent.trim();
                
                if (!textContent) {
                    return;
                }
                
                // リンク化を試みる
                const linkedHtml = linkGermanTextToDic(textContent);
                
                // リンクが生成された場合のみ更新
                if (linkedHtml !== escapeHtml(textContent)) {
                    element.innerHTML = linkedHtml;
                    linksApplied++;
                }
            });
            
            console.log(`[DicLinking] Applied ${linksApplied} links`);
            
        } catch (error) {
            console.error('[DicLinking] Error applying links:', error);
            // エラーが発生しても既存機能には影響しない
        }
    }
    
    /**
     * 改行を含むテキストを処理する場合（将来の拡張用）
     * 
     * 現在は使用していないが、複数行のドイツ語テキストを処理する必要がある場合に使用
     */
    function linkTextWithLineBreaks(text) {
        if (!text) return '';
        
        // 改行で分割してそれぞれ処理
        return text.split(/\n/).map(line => {
            return linkGermanTextToDic(line.trim());
        }).join('<br>');
    }
    
    // グローバルスコープに公開
    window.initDicLinking = initDicLinking;
    window.applyDicLinksToPage = applyDicLinksToPage;
    window.linkGermanTextToDic = linkGermanTextToDic;
    
    // ページ読み込み時に初期化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            initDicLinking();
        });
    } else {
        // DOMContentLoadedが既に発火している場合
        initDicLinking();
    }
    
    console.log('[DicLinking] Script loaded');
    
})();

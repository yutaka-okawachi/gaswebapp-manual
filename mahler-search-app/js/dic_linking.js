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
        
        let normalized = text.toLowerCase()
            .replace(/ä/g, 'ae')
            .replace(/ö/g, 'oe')
            .replace(/ü/g, 'ue')
            .replace(/ß/g, 'ss')
            .replace(/\s+/g, '-'); // スペースをハイフンに置換
            
        // GAS側の normalizeForId と完全に一致させる
        // 英数字とハイフンのみを残す
        normalized = normalized.split('').map(char => {
            if (/[a-z0-9\-]/.test(char)) return char;
            return '';
        }).join('');

        return normalized
            .replace(/-+/g, '-')   // 連続するハイフンをまとめる
            .trim()
            .replace(/^-+|-+$/g, ''); // 先頭と末尾のハイフンを除去
    }
    
    /**
     * 単一のドイツ語テキストまたはテキスト内の単語をリンク化する
     * 
     * @param {string} text - ドイツ語テキスト
     * @return {string} リンク化されたHTML
     */
    function linkGermanTextToDic(text) {
        if (!text || !window.dicLinkingEnabled || !window.dicTermsIndex) {
            return escapeHtml(text);
        }
        
        // 記号やスペースを保持したままトークン化
        // 分割ルール：スペース、括弧、引用符、コロン、セミコロン、カンマ、ドット（ただし直後に数字がない場合）
        const tokens = text.split(/(\s+|[()\[\]{}'":;,]|(?<!\d)\.(?!\d))/);
        
        let resultHtml = '';
        let i = 0;
        
        while (i < tokens.length) {
            const token = tokens[i];
            
            // 区切り文字や空文字はそのまま追加
            if (!token || /^\s+|[()\[\]{}'":;,.]/.test(token)) {
                resultHtml += escapeHtml(token);
                i++;
                continue;
            }
            
            // 最長一致（Greedy Match）を試みる
            let longestMatch = null;
            let tokensToConsume = 1;
            let currentPhrase = token;
            
            // 1. まず現在のトークン単体を確認
            const normalizedToken = normalizeGerman(token);
            if (window.dicTermsIndex[normalizedToken]) {
                longestMatch = {
                    id: window.dicTermsIndex[normalizedToken],
                    text: currentPhrase
                };
            }
            
            // 2. 先読みして長いフレーズを探す（最大5トークン先まで）
            let lookAheadStr = currentPhrase;
            for (let j = 1; j <= 8 && (i + j) < tokens.length; j++) {
                lookAheadStr += tokens[i + j];
                const normalizedPhrase = normalizeGerman(lookAheadStr);
                
                // フレーズが辞書にあるか確認
                if (window.dicTermsIndex[normalizedPhrase]) {
                    longestMatch = {
                        id: window.dicTermsIndex[normalizedPhrase],
                        text: lookAheadStr
                    };
                    tokensToConsume = j + 1;
                }
            }
            
            if (longestMatch) {
                resultHtml += `<a href="dic_experimental.html#${longestMatch.id}" title="用語集で確認: ${escapeHtml(longestMatch.text)}" class="dic-link">${escapeHtml(longestMatch.text)}</a>`;
                i += tokensToConsume;
            } else {
                resultHtml += escapeHtml(token);
                i++;
            }
        }
        
        return resultHtml;
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
     * 動的に追加される検索結果を監視する MutationObserver
     */
    function setupMutationObserver() {
        // すでに監視中の場合は何もしない
        if (window.dicObserver) {
            return;
        }

        console.log('[DicLinking] Setting up MutationObserver...');
        
        const observer = new MutationObserver((mutations) => {
            let shouldApply = false;
            for (const mutation of mutations) {
                if (mutation.addedNodes.length > 0) {
                    shouldApply = true;
                    break;
                }
            }
            
            if (shouldApply) {
                // 大量のノードが追加された場合のパフォーマンスを考慮し、少し遅延させて実行
                if (window.dicLinkTimeout) {
                    clearTimeout(window.dicLinkTimeout);
                }
                window.dicLinkTimeout = setTimeout(() => {
                    applyDicLinksToPage();
                }, 100);
            }
        });

        // body全体を監視（検索結果のコンテナがページによって異なるため）
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        window.dicObserver = observer;
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
            initDicLinking().then(() => {
                applyDicLinksToPage();
                setupMutationObserver();
            });
        });
    } else {
        // DOMContentLoadedが既に発火している場合
        initDicLinking().then(() => {
            applyDicLinksToPage();
            setupMutationObserver();
        });
    }
    
    console.log('[DicLinking] Script loaded');
    
})();

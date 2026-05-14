/**
 * score_metadata.js
 * 作品ごとの詳細な楽譜情報（出版社、プレート番号、版情報、IMSLPリンク）を定義します。
 */

const SCORE_METADATA = {
    // --- Richard Wagner ---
    "feen": {
        "title": "妖精 (Die Feen)",
        "workNo": "WWV 32",
        "publisher": "Breitkopf & Härtel",
        "plate": "N/A",
        "edition": "Band 13 of the old complete works.",
        "imslp": "https://imslp.org/wiki/Die_Feen,_WWV_32_(Wagner,_Richard)"
    },
    "liebes": {
        "title": "恋愛禁制 (Das Liebesverbot)",
        "workNo": "WWV 38",
        "publisher": "Breitkopf & Härtel",
        "plate": "N/A",
        "edition": "Full Score. (Vocal Score: Plate 26945)",
        "imslp": "https://imslp.org/wiki/Das_Liebesverbot,_WWV_38_(Wagner,_Richard)"
    },
    "rienzi": {
        "title": "リエンツィ、最後の護民官 (Rienzi, der Letzte der Tribunen)",
        "workNo": "WWV 49",
        "publisher": "Adolph Fürstner",
        "plate": "A. 5970 F.",
        "edition": "Full Score. (Overture reprint: A. 2863 F.)",
        "imslp": "https://imslp.org/wiki/Rienzi,_WWV_49_(Wagner,_Richard)"
    },
    "holländer": {
        "title": "さまよえるオランダ人 (Der fliegende Holländer)",
        "workNo": "WWV 63",
        "publisher": "Adolph Fürstner",
        "plate": "A. 2760 F.",
        "edition": "Full Score. Ed: Weingartner. (Plate 9810 is Peters VS)",
        "imslp": "https://imslp.org/wiki/Der_fliegende_Holl%C3%A4nder,_WWV_63_(Wagner,_Richard)"
    },
    "hollaender": { // Normalization fallback
        "title": "さまよえるオランダ人 (Der fliegende Holländer)",
        "workNo": "WWV 63",
        "publisher": "Adolph Fürstner",
        "plate": "A. 2760 F.",
        "edition": "Full Score. Ed: Weingartner. (Plate 9810 is Peters VS)",
        "imslp": "https://imslp.org/wiki/Der_fliegende_Holl%C3%A4nder,_WWV_63_(Wagner,_Richard)"
    },
    "tann_dresden": {
        "title": "タンホイザー (Tannhäuser-Dresden)",
        "workNo": "WWV 70",
        "publisher": "C.F. Peters",
        "plate": "10352",
        "edition": "Full Score. Ed: Felix Mottl.",
        "imslp": "https://imslp.org/wiki/Tannh%C3%A4user,_WWV_70_(Wagner,_Richard)"
    },
    "tann_paris": {
        "title": "タンホイザー (Tannhäuser-Paris)",
        "workNo": "WWV 70",
        "publisher": "C.F. Peters",
        "plate": "10352",
        "edition": "Full Score. Ed: Felix Mottl.",
        "imslp": "https://imslp.org/wiki/Tannh%C3%A4user,_WWV_70_(Wagner,_Richard)"
    },
    "lohengrin": {
        "title": "ローエングリン (Lohengrin)",
        "workNo": "WWV 75",
        "publisher": "Breitkopf & Härtel",
        "plate": "15451",
        "edition": "Full Score (ca. 1881).",
        "imslp": "https://imslp.org/wiki/Lohengrin,_WWV_75_(Wagner,_Richard)"
    },
    "rheingold": {
        "title": "ラインの黄金 (Das Rheingold)",
        "workNo": "WWV 86A",
        "publisher": "B. Schott's Söhne",
        "plate": "20800",
        "edition": "Full Score (1873).",
        "imslp": "https://imslp.org/wiki/Das_Rheingold,_WWV_86A_(Wagner,_Richard)"
    },
    "walküre": {
        "title": "ワルキューレ (Die Walküre)",
        "workNo": "WWV 86B",
        "publisher": "C.F. Peters",
        "plate": "10170",
        "edition": "Ed: Felix Mottl. (Schott Plate: 27001a/b)",
        "imslp": "https://imslp.org/wiki/Die_Walk%C3%BCre,_WWV_86B_(Wagner,_Richard)"
    },
    "walkuere": { // Normalization fallback
        "title": "ワルキューレ (Die Walküre)",
        "workNo": "WWV 86B",
        "publisher": "C.F. Peters",
        "plate": "10170",
        "edition": "Ed: Felix Mottl. (Schott Plate: 27001a/b)",
        "imslp": "https://imslp.org/wiki/Die_Walk%C3%BCre,_WWV_86B_(Wagner,_Richard)"
    },
    "siegfried": {
        "title": "ジークフリート (Siegfried)",
        "workNo": "WWV 86C",
        "publisher": "B. Schott's Söhne",
        "plate": "21544",
        "edition": "Full Score (1876).",
        "imslp": "https://imslp.org/wiki/Siegfried,_WWV_86C_(Wagner,_Richard)"
    },
    "götter": {
        "title": "神々の黄昏 (Götterdämmerung)",
        "workNo": "WWV 86D",
        "publisher": "B. Schott's Söhne",
        "plate": "21593",
        "edition": "Full Score (1876).",
        "imslp": "https://imslp.org/wiki/G%C3%B6tterd%C3%A4mmerung,_WWV_86D_(Wagner,_Richard)"
    },
    "goetter": { // Normalization fallback
        "title": "神々の黄昏 (Götterdämmerung)",
        "workNo": "WWV 86D",
        "publisher": "B. Schott's Söhne",
        "plate": "21593",
        "edition": "Full Score (1876).",
        "imslp": "https://imslp.org/wiki/G%C3%B6tterd%C3%A4mmerung,_WWV_86D_(Wagner,_Richard)"
    },
    "tristan": {
        "title": "トリスタンとイゾルデ (Tristan und Isolde)",
        "workNo": "WWV 90",
        "publisher": "C.F. Peters",
        "plate": "9904",
        "edition": "Historical editions on IMSLP.",
        "imslp": "https://imslp.org/wiki/Tristan_und_Isolde,_WWV_90_(Wagner,_Richard)"
    },
    "meister": {
        "title": "ニュルンベルクのマイスタージンガー (Die Meistersinger von Nürnberg)",
        "workNo": "WWV 96",
        "publisher": "B. Schott's Söhne",
        "plate": "27107.275",
        "edition": "Full Score (ca. 1903). (Prelude: 18469)",
        "imslp": "https://imslp.org/wiki/Die_Meistersinger_von_N%C3%BCrnberg,_WWV_96_(Wagner,_Richard)"
    },
    "parsifal": {
        "title": "パルジファル (Parsifal)",
        "workNo": "WWV 111",
        "publisher": "C.F. Peters",
        "plate": "10261",
        "edition": "Ed: Felix Mottl (ca. 1920). (Schott: 23571 / 27200)",
        "imslp": "https://imslp.org/wiki/Parsifal,_WWV_111_(Wagner,_Richard)"
    },

    // --- Richard Strauss ---
    "guntram": {
        "title": "グントラム (Guntram)",
        "workNo": "Op. 25 / TrV 160",
        "publisher": "Adolph Fürstner",
        "plate": "A. 9027 F.",
        "edition": "Full Score.",
        "imslp": "https://imslp.org/wiki/Guntram,_Op.25_(Strauss,_Richard)"
    },
    "feuersnot": {
        "title": "火の危機 (Feuersnot)",
        "workNo": "Op. 50 / TrV 203",
        "publisher": "Adolph Fürstner",
        "plate": "A. 9028 F.",
        "edition": "Full Score. (Love Scene: A. 5208 F.)",
        "imslp": "https://imslp.org/wiki/Feuersnot,_Op.50_(Strauss,_Richard)"
    },
    "salome": {
        "title": "サロメ (Salome)",
        "workNo": "Op. 54 / TrV 215",
        "publisher": "Adolph Fürstner",
        "plate": "A. 5500 F.",
        "edition": "Original and reduced orchestration available.",
        "imslp": "https://imslp.org/wiki/Salome,_Op.54_(Strauss,_Richard)"
    },
    "elektra": {
        "title": "エレクトラ (Elektra)",
        "workNo": "Op. 58 / TrV 223",
        "publisher": "Adolph Fürstner",
        "plate": "A. 5650 5661 F.",
        "edition": "Full Score published in 1916.",
        "imslp": "https://imslp.org/wiki/Elektra,_Op.58_(Strauss,_Richard)"
    },
    "rosenkavalier": {
        "title": "ばらの騎士 (Der Rosenkavalier)",
        "workNo": "Op. 59 / TrV 227",
        "publisher": "Adolph Fürstner",
        "plate": "A. 5900 F.",
        "edition": "Full Score.",
        "imslp": "https://imslp.org/wiki/Der_Rosenkavalier,_Op.59_(Strauss,_Richard)"
    },
    "ariadne": {
        "title": "ナクソス島のアリアドネ (Ariadne auf Naxos)",
        "workNo": "Op. 60 / TrV 228",
        "publisher": "Adolph Fürstner",
        "plate": "A. 7450 F.",
        "edition": "1916 version. (1912 version: Plate A. 6300 F.)",
        "imslp": "https://imslp.org/wiki/Ariadne_auf_Naxos,_Op.60_(Strauss,_Richard)"
    },
    "schatten": {
        "title": "影のない女 (Die Frau ohne Schatten)",
        "workNo": "Op. 65 / TrV 234",
        "publisher": "Adolph Fürstner",
        "plate": "A. 7500 F.",
        "edition": "Full Score.",
        "imslp": "https://imslp.org/wiki/Die_Frau_ohne_Schatten,_Op.65_(Strauss,_Richard)"
    },
    "intermezzo": {
        "title": "インターメッツォ (Intermezzo)",
        "workNo": "Op. 72 / TrV 246",
        "publisher": "Adolph Fürstner",
        "plate": "A. 7800 F.",
        "edition": "Full Score (1924).",
        "imslp": "https://imslp.org/wiki/Intermezzo,_Op.72_(Strauss,_Richard)"
    },
    "helena": {
        "title": "エジプトのヘレナ (Die ägyptische Helena)",
        "workNo": "Op. 75 / TrV 255",
        "publisher": "Adolph Fürstner",
        "plate": "A. 9029 F.",
        "edition": "Full Score (1928). (Plate A. 7900 F.)",
        "imslp": "https://imslp.org/wiki/Die_%C3%A4gyptische_Helena,_Op.75_(Strauss,_Richard)"
    },
    "arabella": {
        "title": "アラベラ (Arabella)",
        "workNo": "Op. 79 / TrV 263",
        "publisher": "Verlag Dr. Richard Strauss",
        "plate": "A. 8250 F.",
        "edition": "Reissue: Adolph Fürstner.",
        "imslp": "https://imslp.org/wiki/Arabella,_Op.79_(Strauss,_Richard)"
    },
    "schweigsame": {
        "title": "無口な女 (Die schweigsame Frau)",
        "workNo": "Op. 80 / TrV 265",
        "publisher": "Verlag Dr. Richard Strauss",
        "plate": "A. 8300 F.",
        "edition": "Reissue: Adolphe Fürstner (1935).",
        "imslp": "https://imslp.org/wiki/Die_schweigsame_Frau,_Op.80_(Strauss,_Richard)"
    },
    "tag": {
        "title": "平和の日 (Friedenstag)",
        "workNo": "Op. 81 / TrV 271",
        "publisher": "Verlag Dr. Richard Strauss",
        "plate": "A. 9032 F.",
        "edition": "Full Score (1938).",
        "imslp": "https://imslp.org/wiki/Friedenstag,_Op.81_(Strauss,_Richard)"
    },
    "daphne": {
        "title": "ダフネ (Daphne)",
        "workNo": "Op. 82 / TrV 272",
        "publisher": "Vienna: Richard Strauss",
        "plate": "N/A",
        "edition": "Reprinted by Schott (1998). (VS: 8383)",
        "imslp": "https://imslp.org/wiki/Daphne,_Op.82_(Strauss,_Richard)"
    },
    "danae": {
        "title": "ダナエの愛 (Die Liebe der Danae)",
        "workNo": "Op. 83 / TrV 278",
        "publisher": "Vienna: Richard Strauss",
        "plate": "R. St. 99",
        "edition": "Full Score (1944). Plate A. 9033 F is likely VS info.",
        "imslp": "https://imslp.org/wiki/Die_Liebe_der_Danae,_Op.83_(Strauss,_Richard)"
    },
    "cap": {
        "title": "カプリッチョ (Capriccio)",
        "workNo": "Op. 85 / TrV 279",
        "publisher": "B. Schott / Boosey",
        "plate": "N/A",
        "edition": "Identified as IMSLP file #24954.",
        "imslp": "https://imslp.org/wiki/Capriccio,_Op.85_(Strauss,_Richard)"
    }
};

// Global for GAS and Client-side
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SCORE_METADATA;
}

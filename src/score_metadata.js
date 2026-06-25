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
        "imslp": "https://imslp.org/wiki/Die_Feen,_WWV_32_(Wagner,_Richard)",
        "synopsis": "https://drive.google.com/file/d/1S6eM9_i_Eu1lAVfODo4QeVUzelbOc4Wf/view?usp=drive_link"
    },
    "liebes": {
        "title": "恋愛禁制 (Das Liebesverbot)",
        "workNo": "WWV 38",
        "publisher": "Breitkopf & Härtel",
        "plate": "N/A",
        "edition": "Full Score. (Vocal Score: Plate 26945)",
        "imslp": "https://imslp.org/wiki/Das_Liebesverbot,_WWV_38_(Wagner,_Richard)",
        "synopsis": "https://drive.google.com/file/d/1mOkxloYAwWW4DKuF14HROq65PTpIMyYG/view?usp=drive_link"
    },
    "rienzi": {
        "title": "リエンツィ、最後の護民官 (Rienzi, der Letzte der Tribunen)",
        "workNo": "WWV 49",
        "publisher": "Adolph Fürstner",
        "plate": "A. 5970 F.",
        "edition": "Full Score. (Overture reprint: A. 2863 F.)",
        "imslp": "https://imslp.org/wiki/Rienzi,_WWV_49_(Wagner,_Richard)",
        "synopsis": "https://drive.google.com/file/d/16I-bikJn0ciy8R1JPIJ_lHjgH44iLoy9/view?usp=drive_link"
    },
    "holländer": {
        "title": "さまよえるオランダ人 (Der fliegende Holländer)",
        "workNo": "WWV 63",
        "publisher": "Adolph Fürstner",
        "plate": "A. 2760 F.",
        "edition": "Full Score. Ed: Weingartner. (Plate 9810 is Peters VS)",
        "imslp": "https://imslp.org/wiki/Der_fliegende_Holl%C3%A4nder,_WWV_63_(Wagner,_Richard)",
        "synopsis": "https://drive.google.com/file/d/1YGul1KGVdc0UcAe3-cx_2XOAPvdSbFJh/view?usp=sharing"
    },
    "hollaender": { // Normalization fallback
        "title": "さまよえるオランダ人 (Der fliegende Holländer)",
        "workNo": "WWV 63",
        "publisher": "Adolph Fürstner",
        "plate": "A. 2760 F.",
        "edition": "Full Score. Ed: Weingartner. (Plate 9810 is Peters VS)",
        "imslp": "https://imslp.org/wiki/Der_fliegende_Holl%C3%A4nder,_WWV_63_(Wagner,_Richard)",
        "synopsis": "https://drive.google.com/file/d/1YGul1KGVdc0UcAe3-cx_2XOAPvdSbFJh/view?usp=sharing"
    },
    "tann_dresden": {
        "title": "タンホイザー (Tannhäuser-Dresden)",
        "workNo": "WWV 70",
        "publisher": "C.F. Peters",
        "plate": "10352",
        "edition": "Full Score. Ed: Felix Mottl.",
        "imslp": "https://imslp.org/wiki/Tannh%C3%A4user,_WWV_70_(Wagner,_Richard)",
        "synopsis": "https://drive.google.com/file/d/1ghyR1l9WTfUQdknC4Np36CM6A-bVxfkP/view?usp=drive_link"
    },
    "tann_paris": {
        "title": "タンホイザー (Tannhäuser-Paris)",
        "workNo": "WWV 70",
        "publisher": "C.F. Peters",
        "plate": "10352",
        "edition": "Full Score. Ed: Felix Mottl.",
        "imslp": "https://imslp.org/wiki/Tannh%C3%A4user,_WWV_70_(Wagner,_Richard)",
        "synopsis": "https://drive.google.com/file/d/1ghyR1l9WTfUQdknC4Np36CM6A-bVxfkP/view?usp=drive_link"
    },
    "lohengrin": {
        "title": "ローエングリン (Lohengrin)",
        "workNo": "WWV 75",
        "publisher": "Breitkopf & Härtel",
        "plate": "15451",
        "edition": "Full Score (ca. 1881).",
        "imslp": "https://imslp.org/wiki/Lohengrin,_WWV_75_(Wagner,_Richard)",
        "synopsis": "https://drive.google.com/file/d/1PW47yOi-kDxXjlSignXg28Ezo0D9BxFI/view?usp=drive_link"
    },
    "rheingold": {
        "title": "ラインの黄金 (Das Rheingold)",
        "workNo": "WWV 86A",
        "publisher": "B. Schott's Söhne",
        "plate": "20800",
        "edition": "Full Score (1873).",
        "imslp": "https://imslp.org/wiki/Das_Rheingold,_WWV_86A_(Wagner,_Richard)",
        "synopsis": "https://drive.google.com/file/d/1yJHFWm5F4yKXxhJjhCDst20Y5x5GOVuF/view?usp=drive_link"
    },
    "walküre": {
        "title": "ワルキューレ (Die Walküre)",
        "workNo": "WWV 86B",
        "publisher": "C.F. Peters",
        "plate": "10170",
        "edition": "Ed: Felix Mottl. (Schott Plate: 27001a/b)",
        "imslp": "https://imslp.org/wiki/Die_Walk%C3%BCre,_WWV_86B_(Wagner,_Richard)",
        "synopsis": "https://drive.google.com/file/d/1vOyWpzLg_kdYaRT6_IeDsk23jJ1Ehz6h/view?usp=drive_link"
    },
    "walkuere": { // Normalization fallback
        "title": "ワルキューレ (Die Walküre)",
        "workNo": "WWV 86B",
        "publisher": "C.F. Peters",
        "plate": "10170",
        "edition": "Ed: Felix Mottl. (Schott Plate: 27001a/b)",
        "imslp": "https://imslp.org/wiki/Die_Walk%C3%BCre,_WWV_86B_(Wagner,_Richard)",
        "synopsis": "https://drive.google.com/file/d/1vOyWpzLg_kdYaRT6_IeDsk23jJ1Ehz6h/view?usp=drive_link"
    },
    "siegfried": {
        "title": "ジークフリート (Siegfried)",
        "workNo": "WWV 86C",
        "publisher": "B. Schott's Söhne",
        "plate": "21544",
        "edition": "Full Score (1876).",
        "imslp": "https://imslp.org/wiki/Siegfried,_WWV_86C_(Wagner,_Richard)",
        "synopsis": "https://drive.google.com/file/d/1Yj4mlnkx5M-AhGw7Vbl_BXaWHke8NFcD/view?usp=drive_link"
    },
    "götter": {
        "title": "神々の黄昏 (Götterdämmerung)",
        "workNo": "WWV 86D",
        "publisher": "B. Schott's Söhne",
        "plate": "21593",
        "edition": "Full Score (1876).",
        "imslp": "https://imslp.org/wiki/G%C3%B6tterd%C3%A4mmerung,_WWV_86D_(Wagner,_Richard)",
        "synopsis": "https://drive.google.com/file/d/1T26qiCNB5LgUv_VAM6I3i8IJnVGX_3dO/view?usp=drive_link"
    },
    "goetter": { // Normalization fallback
        "title": "神々の黄昏 (Götterdämmerung)",
        "workNo": "WWV 86D",
        "publisher": "B. Schott's Söhne",
        "plate": "21593",
        "edition": "Full Score (1876).",
        "imslp": "https://imslp.org/wiki/G%C3%B6tterd%C3%A4mmerung,_WWV_86D_(Wagner,_Richard)",
        "synopsis": "https://drive.google.com/file/d/1T26qiCNB5LgUv_VAM6I3i8IJnVGX_3dO/view?usp=drive_link"
    },
    "tristan": {
        "title": "トリスタンとイゾルデ (Tristan und Isolde)",
        "workNo": "WWV 90",
        "publisher": "C.F. Peters",
        "plate": "9904",
        "edition": "Historical editions on IMSLP.",
        "imslp": "https://imslp.org/wiki/Tristan_und_Isolde,_WWV_90_(Wagner,_Richard)",
        "synopsis": "https://drive.google.com/file/d/1B3-7eFKCbzwsGqLYEm8UyCfV1UGh0alD/view?usp=drive_link"
    },
    "meister": {
        "title": "ニュルンベルクのマイスタージンガー (Die Meistersinger von Nürnberg)",
        "workNo": "WWV 96",
        "publisher": "B. Schott's Söhne",
        "plate": "27107.27500",
        "edition": "Full Score (ca. 1903). (Prelude: 18469)",
        "imslp": "https://imslp.org/wiki/Die_Meistersinger_von_N%C3%BCrnberg,_WWV_96_(Wagner,_Richard)",
        "synopsis": "https://drive.google.com/file/d/1Dxxu6js8LdX9TiOdHWZtk_lE-K12LxnR/view?usp=drive_link"
    },
    "parsifal": {
        "title": "パルジファル (Parsifal)",
        "workNo": "WWV 111",
        "publisher": "C.F. Peters",
        "plate": "10261",
        "edition": "Ed: Felix Mottl (ca. 1920). (Schott: 23571 / 27200)",
        "imslp": "https://imslp.org/wiki/Parsifal,_WWV_111_(Wagner,_Richard)",
        "synopsis": "https://drive.google.com/file/d/1wVaDRlIQe4KOeZH8qL2ZchflM_8bk_QW/view?usp=drive_link"
    },

    // --- Richard Strauss ---
    "guntram": {
        "title": "グントラム (Guntram)",
        "workNo": "Op. 25 / TrV 160",
        "publisher": "Adolph Fürstner",
        "plate": "A. 9027 F.",
        "edition": "Full Score.",
        "imslp": "https://imslp.org/wiki/Guntram,_Op.25_(Strauss,_Richard)",
        "synopsis": "https://drive.google.com/file/d/1Mb7TPMcxkW7GcnoK9uTqNcdgG4ybYabe/view?usp=drive_link"
    },
    "feuersnot": {
        "title": "火の危機 (Feuersnot)",
        "workNo": "Op. 50 / TrV 203",
        "publisher": "Adolph Fürstner",
        "plate": "A. 9028 F.",
        "edition": "Full Score. (Love Scene: A. 5208 F.)",
        "imslp": "https://imslp.org/wiki/Feuersnot,_Op.50_(Strauss,_Richard)",
        "synopsis": "https://drive.google.com/file/d/1RaTY3N2b55NexzkpImPJKQbW3z0QvLnh/view?usp=drive_link"
    },
    "salome": {
        "title": "サロメ (Salome)",
        "workNo": "Op. 54 / TrV 215",
        "publisher": "Adolph Fürstner",
        "plate": "A. 5500 F.",
        "edition": "Original and reduced orchestration available.",
        "imslp": "https://imslp.org/wiki/Salome,_Op.54_(Strauss,_Richard)",
        "synopsis": "https://drive.google.com/file/d/1i6W4M5nkfKhtyd5UjPZTqnnCKfRL2UsQ/view?usp=drive_link"
    },
    "elektra": {
        "title": "エレクトラ (Elektra)",
        "workNo": "Op. 58 / TrV 223",
        "publisher": "Adolph Fürstner",
        "plate": "A. 5650 5661 F.",
        "edition": "Full Score published in 1916.",
        "imslp": "https://imslp.org/wiki/Elektra,_Op.58_(Strauss,_Richard)",
        "synopsis": "https://drive.google.com/file/d/1UUJKyDdaQKyjeUNGF4Le6wHl5_GOS8ac/view?usp=drive_link"
    },
    "rosenkavalier": {
        "title": "ばらの騎士 (Der Rosenkavalier)",
        "workNo": "Op. 59 / TrV 227",
        "publisher": "Adolph Fürstner",
        "plate": "A. 5900 F.",
        "edition": "Full Score.",
        "imslp": "https://imslp.org/wiki/Der_Rosenkavalier,_Op.59_(Strauss,_Richard)",
        "synopsis": "https://drive.google.com/file/d/1Q8-kcPqVLc63rfL-orH-s4xFSr46AcO_/view?usp=drive_link"
    },
    "ariadne": {
        "title": "ナクソス島のアリアドネ (Ariadne auf Naxos)",
        "workNo": "Op. 60 / TrV 228",
        "publisher": "Adolph Fürstner",
        "plate": "A. 7450 F.",
        "edition": "1916 version. (1912 version: Plate A. 6300 F.)",
        "imslp": "https://imslp.org/wiki/Ariadne_auf_Naxos,_Op.60_(Strauss,_Richard)",
        "synopsis": "https://drive.google.com/file/d/1C5kOM9GhPblHv8c0b8Q-k1DvMigkA15Z/view?usp=drive_link"
    },
    "schatten": {
        "title": "影のない女 (Die Frau ohne Schatten)",
        "workNo": "Op. 65 / TrV 234",
        "publisher": "Adolph Fürstner",
        "plate": "A. 7500 F.",
        "edition": "Full Score.",
        "imslp": "https://imslp.org/wiki/Die_Frau_ohne_Schatten,_Op.65_(Strauss,_Richard)",
        "synopsis": "https://drive.google.com/file/d/1VgM32B4Dr5I9UlQu17vzG--B2VbMZl5z/view?usp=drive_link"
    },
    "intermezzo": {
        "title": "インターメッツォ (Intermezzo)",
        "workNo": "Op. 72 / TrV 246",
        "publisher": "Adolph Fürstner",
        "plate": "A. 7800 F.",
        "edition": "Full Score (1924).",
        "imslp": "https://imslp.org/wiki/Intermezzo,_Op.72_(Strauss,_Richard)",
        "synopsis": "https://drive.google.com/file/d/1pxOyOn2e12O4eibzdIeCP5QpyqEBaNXs/view?usp=drive_link"
    },
    "helena": {
        "title": "エジプトのヘレナ (Die ägyptische Helena)",
        "workNo": "Op. 75 / TrV 255",
        "publisher": "Adolph Fürstner",
        "plate": "A. 9029 F.",
        "edition": "Full Score (1928). (Plate A. 7900 F.)",
        "imslp": "https://imslp.org/wiki/Die_%C3%A4gyptische_Helena,_Op.75_(Strauss,_Richard)",
        "synopsis": "https://drive.google.com/file/d/1J2eLY544NXROSwB-ZqtpVFybl9qTv0kV/view?usp=drive_link"
    },
    "arabella": {
        "title": "アラベラ (Arabella)",
        "workNo": "Op. 79 / TrV 263",
        "publisher": "Verlag Dr. Richard Strauss",
        "plate": "A. 8250 F.",
        "edition": "Reissue: Adolph Fürstner.",
        "imslp": "https://imslp.org/wiki/Arabella,_Op.79_(Strauss,_Richard)",
        "synopsis": "https://drive.google.com/file/d/169dQoZxqOptJrdlTN7kw_ikJMQcUx74P/view?usp=drive_link"
    },
    "schweigsame": {
        "title": "無口な女 (Die schweigsame Frau)",
        "workNo": "Op. 80 / TrV 265",
        "publisher": "Verlag Dr. Richard Strauss",
        "plate": "A. 8300 F.",
        "edition": "Reissue: Adolphe Fürstner (1935).",
        "imslp": "https://imslp.org/wiki/Die_schweigsame_Frau,_Op.80_(Strauss,_Richard)",
        "synopsis": "https://drive.google.com/file/d/1r6790SGrE_zwaaS55WbZuvm22y5NmC8A/view?usp=drive_link"
    },
    "tag": {
        "title": "平和の日 (Friedenstag)",
        "workNo": "Op. 81 / TrV 271",
        "publisher": "Verlag Dr. Richard Strauss",
        "plate": "A. 9032 F.",
        "edition": "Full Score (1938).",
        "imslp": "https://imslp.org/wiki/Friedenstag,_Op.81_(Strauss,_Richard)",
        "synopsis": "https://drive.google.com/file/d/18T6kMSsJZBGY6X_YSSx_TDAYhfZfLB-A/view?usp=drive_link"
    },
    "daphne": {
        "title": "ダフネ (Daphne)",
        "workNo": "Op. 82 / TrV 272",
        "publisher": "Vienna: Richard Strauss",
        "plate": "N/A",
        "edition": "Reprinted by Schott (1998). (VS: 8383)",
        "imslp": "https://imslp.org/wiki/Daphne,_Op.82_(Strauss,_Richard)",
        "synopsis": "https://drive.google.com/file/d/1L2v7WvY8iLa9y4qTUXWPT3sEeU74vxIf/view?usp=drive_link"
    },
    "danae": {
        "title": "ダナエの愛 (Die Liebe der Danae)",
        "workNo": "Op. 83 / TrV 278",
        "publisher": "Vienna: Richard Strauss",
        "plate": "R. St. 99",
        "edition": "Full Score (1944). Plate A. 9033 F is likely VS info.",
        "imslp": "https://imslp.org/wiki/Die_Liebe_der_Danae,_Op.83_(Strauss,_Richard)",
        "synopsis": "https://drive.google.com/file/d/11CCDJSOvt3uTeklfNQ0ybRhDWkpGWmdC/view?usp=drive_link"
    },
    "cap": {
        "title": "カプリッチョ (Capriccio)",
        "workNo": "Op. 85 / TrV 279",
        "publisher": "B. Schott / Boosey",
        "plate": "N/A",
        "edition": "Identified as IMSLP file #24954.",
        "imslp": "https://imslp.org/wiki/Capriccio,_Op.85_(Strauss,_Richard)",
        "synopsis": "https://drive.google.com/file/d/1eZBswrQvVtc84zFhs29zO-saPKDrvKD8/view?usp=drive_link"
    }
};

// Global for GAS and Client-side
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SCORE_METADATA;
}

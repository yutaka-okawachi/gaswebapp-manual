function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
    // Helper function to handle empty values
    function getValue(val) {
      return (val && val !== "N/A") ? val : "未指定";
    }

    var work = getValue(data.work);
    var scope = getValue(data.scope);
    var term = getValue(data.term);
    var page = getValue(data.page);
    var userAgent = getValue(data.userAgent);
    
    var now = new Date();
    // Use JST for the timestamp
    var formattedDate = Utilities.formatDate(now, "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss");

    var subject = "【マーラー検索】検索通知: " + work;
    
    var body = "マーラー検索アプリで新しい検索がありました。\n\n" +
               "■ 検索詳細\n" +
               "--------------------------------------------------\n" +
               "【日時】 " + formattedDate + "\n" +
               "【作品】 " + work + "\n" +
               "【検索語】 " + term + "\n" +
               "【範囲】 " + scope + "\n" +
               "【ページ】 " + page + "\n" +
               "--------------------------------------------------\n\n" +
               "■ ユーザー環境\n" +
               userAgent;
               
    MailApp.sendEmail({
      to: 'pistares@ezweb.ne.jp',
      subject: subject,
      body: body
    });
    
    return ContentService.createTextOutput(JSON.stringify({status: "success"}))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({status: "error", message: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

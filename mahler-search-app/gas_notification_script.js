function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var work = data.work || "N/A";
    var scope = data.scope || "N/A";
    var term = data.term || "N/A";
    var page = data.page || "N/A";
    var userAgent = data.userAgent || "N/A";
    
    var subject = "Mahler Search Notification: " + work;
    var body = "Page: " + page + "\n" +
               "Work: " + work + "\n" +
               "Scope: " + scope + "\n" +
               "Term: " + term + "\n" +
               "User Agent: " + userAgent + "\n" +
               "Time: " + new Date().toString();
               
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

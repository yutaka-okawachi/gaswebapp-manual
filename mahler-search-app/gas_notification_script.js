function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var term = data.term;
    var type = data.type;
    var page = data.page;
    var userAgent = data.userAgent;
    
    var subject = "Mahler Search Notification: " + type;
    var body = "Search Term: " + term + "\n" +
               "Type: " + type + "\n" +
               "Page: " + page + "\n" +
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

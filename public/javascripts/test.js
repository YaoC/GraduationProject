/**
 * Created by cyao on 16-6-2.
 */
function test() {
  createDownloadingProcessBar('111', 'test.jpg', 12345678);
  var i = 0;
  var id = window.setInterval(function () {
    if (i <= 100)
      setBarValue('111', i++);
    else {
      downloadComplete('111', 'test.jpg', 12345678);
      window.clearInterval(id);
    }
  }, 100);
}

function testShowChatrecord(myId, friendId) {
  showChatRecords(myId, friendId).then(function (records) {
    console.log(records);
  }, function (error) {
    console.log(error);
  });
}
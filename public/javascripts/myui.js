var privateKey = null;
var publicKey = null;
var friendsKeys = {};

var unreads = {};
var notificationNum = 0;

$(document).ready(function () {
  privateKey = $("#myPrivateKey").val();
  publicKey = $("#myPublicKey").val();

  $('[data-toggle="popover"]').popover();

  $("#ipt-pic").fileinput({
    language: 'zh',
    allowedFileExtensions : ['jpg', 'png','gif','jpeg'],
    previewFileType:['jpg', 'png','gif','jpeg'],
    showUpload: false,
    showRemove: false
  });
  
  $("#file").fileinput({
    language: 'zh',
    showPreview: false
  });


  var html = "<table class='emotion'>";
  var now = 0;
  for (var i = 0; i < 10; i++) {
    html += "<tr>";
    for (var j = 0; j < 13; j++) {
      now = i * 13 + j + 1;
      html += "<td><img src='face/" + now + ".gif' onclick='emotionToStr(" + now + ")'></td>";
    }
    html += "</tr>";
  }
  html += "</table>";
  $("#emotion-panel").attr("data-content", html);
});

function selectMenu(btn) {
  $("#select-talk").css("display","none");
  $("#select-friends").css("display","none");
  $("#select-notification").css("display","none");
  $("#select-files").css("display","none");
  switch(btn){
    case 1: $("#select-talk").css("display","block");break;
    case 2: $("#select-friends").css("display","block");break;
    case 3: $("#select-notification").css("display","block");break;
    case 4: showFileInfo();$("#select-files").css("display","block");break;
    default:
      $("#select-friends").css("display","block");
      console.log("Some errors on switching the menu ...");
  }
}

function removeSession() {
  $("#session").attr("style","display:none");
}

function removeNotification(id) {
  var id = "#notification-"+id;
  $(id).css("display","none");
}


function showChangePsw() {
  $("#change-psw").css("display","block");
}

function  editInfo() {
  $("#btn-edit").attr("disabled","disabled");
  $("#btn-edit").text("修改中...");
  var nickname = $("#ipt-nickname").val(),
    sex = $("#ipt-sex input[name='sexRadioOptions']:checked").val(),
    birthday = $("#ipt-birthday").val(),
    phone = $("#ipt-phone").val(),
    motto = $("#ipt-motto").val();
  var pData = {
    'nickname': nickname,
    'sex': sex,
    'birthday': birthday,
    'phone': phone,
    'motto': motto
  };
  $.ajax({
    type: "POST",
    url: "/edit",
    data: pData,
    dataType:'json',
    success:function (data) {
      if(data.code==200){
        $("#nickname").text(nickname);
        $("#motto").text(motto);
        $("#my-info").modal('hide');
        $("#ipt-nickname").val(nickname);
        $("#ipt-birthday").val(birthday);
        $("#ipt-phone").val(phone);
        $("#ipt-motto").val(motto);
        if(sex)
          $("#boy").attr("checked","checked");
        else
          $("#girl").attr("checked","checked");
        alertInfoSuccess("个人信息修改成功！");
        $("#btn-edit").removeAttr("disabled");
        $("#btn-edit").text("修改");
      }
    }
  });
}

function upload() {
  $("#btn-upload").attr("disabled","disabled");
  $("#btn-upload").text("上传中...");
  $("#form-pic").ajaxSubmit({
    success:function (data) {
      var link = data.linkurl.toString();
      $.ajax({
        type: "POST",
        url: "/upload",
        data: {'link':link},
        dataType:'json',
        success:function (data) {
          if(data.code==200){
            alertInfoSuccess("头像修改成功！");
            $("#btn-upload").removeAttr("disabled");
            $("#btn-upload").text("上传");
            $("#my-pic").modal('hide');
            $("#myPortrait").attr('src',link);
          }
        }
      });
    },
    error:function (err) {
      console.log(err);
    }
  });
}


function alertInfoSuccess(text) {
  $("#alert-info").empty();
  $("#alert-info").append("<div class=\"alert alert-success alert-dismissible\" role=\"alert\">"+
    "<button type=\"button\" class=\"close\" data-dismiss=\"alert\" aria-label=\"Close\">" +
    "<span aria-hidden=\"true\">&times;</span></button>"+
    "<strong>"+text+"</strong></div>");
  window.setTimeout(function () {
    $("#alert-info").empty();
  },5000);
}


function alertInfoDanger(text) {
  $("#alert-info").empty();
  $("#alert-info").append("<div class=\"alert alert-danger alert-dismissible\" role=\"alert\">"+
    "<button type=\"button\" class=\"close\" data-dismiss=\"alert\" aria-label=\"Close\">" +
    "<span aria-hidden=\"true\">&times;</span></button>"+
    "<strong>"+text+"</strong></div>");
  window.setTimeout(function () {
    $("#alert-info").empty();
  },5000);
}

function alertInfoWarning(text) {
  $("#alert-info").empty();
  $("#alert-info").append("<div class=\"alert alert-warning alert-dismissible\" role=\"alert\">" +
    "<button type=\"button\" class=\"close\" data-dismiss=\"alert\" aria-label=\"Close\">" +
    "<span aria-hidden=\"true\">&times;</span></button>" +
    "<strong>" + text + "</strong></div>");
  window.setTimeout(function () {
    $("#alert-info").empty();
  }, 3000);
}

var searchValidation;

function searchCheck(){
  var content = $("#ipt-friends").val();
  // var emailFilter  = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;
  var idFilter = /^\+?[1-9][0-9]*$/;
  // if(emailFilter.test(content)){
  //   searchValidation = 1;//email
  //   showSuccess("friends");
  //   return true;
  // }
  if(idFilter.test(content)){
    searchValidation = 1;//id
    showSuccess("friends");
    return true;
  }
  searchValidation = 0;
  showError("friends","输入信息有误，请重试");
  return false;
}

function  searchFriend() {
  if(searchValidation==1){
    $("#btn-search").attr("disabled", "disabled");
    $("#btn-search").text("查找中...");
    var content = $("#ipt-friends").val();
    $("#addFriends").modal('hide');
    showFriendInfo(content);
    $("#btn-search").removeAttr("disabled");
    $("#btn-search").text("查找");
  }
}

function showFriendInfo(content) {
  var friendInfo = function (data) {
    // console.log(data);
    if (data.code == 200) {
      console.log(data);
      $("#friends-id").val(data.id);
      $("#friends-nickname").val(data.nickname);
      $("#friends-sex").val((data.sex) ? '男' : '女');
      $("#friends-birthday").val(data.birthday);
      $("#friends-img").attr('src', data.portrait);
      $("#friends-motto").text(data.motto);
      if (data.isFriend) {
        $("#friends-phone").val(data.phone);
        $("#btn-addFriend").attr('onclick', 'deleteFriend(' + data.id + ')');
        $("#btn-addFriend").removeClass();
        $("#btn-addFriend").addClass("btn btn-danger");
        $("#btn-addFriend").text("删除好友");
      } else {
        if (data.id == $("#ipt-userId").val()) {
          $("#friends-phone").val(data.phone);
          $("#btn-addFriend").removeAttr("onclick");
          $("#btn-addFriend").removeClass();
          $("#btn-addFriend").addClass("btn btn-success");
          $("#btn-addFriend").text("我自己");
        } else {
          $("#btn-addFriend").removeClass();
          $("#btn-addFriend").addClass("btn btn-primary");
          $("#btn-addFriend").attr('onclick', 'addFriends(' + data.id + ')');
          $("#btn-addFriend").text("加为好友");
        }
      }
      $("#friend-info").modal('show');
    }
    if (data.code == 404) {
      $("#addFriends").modal('hide');
      alertInfoDanger("没有此用户");
    }
  };
  $.ajax({
    type: "POST",
    url: "/queryById",
    data: {'id': content},
    dataType: 'json',
    success: friendInfo
  });
}

function deleteFriend(id) {
  $("#friend-info").modal('hide');
  var name = $("#nickname" + id).text();
  $("#confirmMessage").text("是否解除与用户 " + name + "(id:" + id + ") 的好友关系？");
  $("#deleteConfirm").attr("onclick", "deleteFriendConfirm(" + id + ")");
  $('#confirm').modal('show')
}

function showError(id,info) {
  $("#ipt-"+id).parent().removeClass();
  $("#ipt-"+id).parent().addClass("form-group has-error has-feedback");
  $("#icon-"+id).attr("class","glyphicon glyphicon-remove form-control-feedback");
  $("#help-"+id).text(info);
}

function showWarning(id,info) {
  $("#ipt-"+id).parent().removeClass();
  $("#ipt-"+id).parent().addClass("form-group has-warning has-feedback");
  $("#icon-"+id).attr("class","glyphicon glyphicon-warning-sign form-control-feedback");
  $("#help-"+id).text(info);
}

function showSuccess(id) {
  $("#ipt-"+id).parent().removeClass();
  $("#ipt-"+id).parent().addClass("form-group has-success has-feedback");
  $("#icon-"+id).attr("class","glyphicon glyphicon-ok form-control-feedback");
  $("#help-"+id).text("");
}

function  showFriendAsk(id,name,time) {
  descNotificationIcon();
  $("#askIcon" + id).remove();
  $("#session").attr("style", "display:none;");
  $("#notification").attr("style", "display:none;");
  $("#p-content").text(name+"(ID："+id+")希望添加你为好友!");
  $("#p-from").text("来自："+name);
  $("#p-time").text(time);
  $("#accept-friend-ask").attr("onclick","acceptFriendsAsk("+id+")");
  $("#reject-friend-ask").attr("onclick","rejectFriendsAsk("+id+")");
  $("#friendAsk").removeAttr("style");
}

function showFriendNotification(title, id, name, time) {
  descNotificationIcon();
  $("#notiIcon" + id).remove();
  $("#session").attr("style", "display:none;");
  $("#friendAsk").attr("style", "display:none;");
  $("#notiTitle").text(title);
  $("#notiContent").text("恭喜！你已和 " + name + "(ID：" + id + ") 成为为好友!");
  $("#notiFrom").text("来自：" + name);
  $("#notiTime").text(time);
  $("#notiDelete").attr("onclick", "delNewFriend(" + id + ")");
  $("#notification").removeAttr("style");
}

function showDelFriendNotification(title, id, name, time) {
  descNotificationIcon();
  $("#delIcon" + id).remove();
  $("#session").attr("style", "display:none;");
  $("#friendAsk").attr("style", "display:none;");
  $("#notiTitle").text(title);
  $("#notiContent").text("很遗憾！" + name + "(ID：" + id + ") 解除了你们的好友关系!你可以尝试重新加" + name + "为好友。");
  $("#notiFrom").text("来自：" + name);
  $("#notiTime").text(time);
  $("#notiDelete").attr("onclick", "delFriendDeleted(" + id + ")");
  $("#notification").removeAttr("style");
}

function showFriendReject(title, id, name, time) {
  descNotificationIcon();
  $("#rejectIcon" + id).remove();
  $("#session").attr("style", "display:none;");
  $("#friendAsk").attr("style", "display:none;");
  $("#notiTitle").text(title);
  $("#notiContent").text("很遗憾！" + name + "(ID：" + id + ") 拒绝了你的好友请求。");
  $("#notiFrom").text("来自：" + name);
  $("#notiTime").text(time);
  $("#notiDelete").attr("onclick", "delFriendReject(" + id + ")");
  $("#notification").removeAttr("style");
}

function removeWindow(id) {
  id = "#"+id;
  $(id).attr('style',"display:none");
}

function searchFile(){
  var md5 = $("#ipt-md5").val();
  getFile(md5).then(function (file) {
    fileError("此文件已在本地存在:" + file.name);
  }, function () {
    socket.emit("searchFile", md5);
    //TODO 添加一个查询中的动态图标
  });
  // socket.emit("searchFile", md5);//Test
}

function uploadFile() {
  addFile();
  $('#file').fileinput('clear');
  return false;
}

function fileSuccess(text) {
  $("#file-alert-info").empty();
  $("#file-alert-info").append("<div class=\"alert alert-success alert-dismissible\" role=\"alert\">"+
    "<button type=\"button\" class=\"close\" data-dismiss=\"alert\" aria-label=\"Close\">" +
    "<span aria-hidden=\"true\">&times;</span></button>"+
    "<strong>"+text+"</strong></div>");
  window.setTimeout(function () {
    $("#file-alert-info").empty();
  },2000);
}


function fileError(text) {
  $("#file-alert-info").empty();
  $("#file-alert-info").append("<div class=\"alert alert-danger alert-dismissible\" role=\"alert\">"+
    "<button type=\"button\" class=\"close\" data-dismiss=\"alert\" aria-label=\"Close\">" +
    "<span aria-hidden=\"true\">&times;</span></button>"+
    "<strong>"+text+"</strong></div>");
}

function createDownloadingProcessBar(fileId, fileName, size) {
  var html = "<div id='downloadingBar-" + fileId + "' class=\"downloadingBar\">\
                <label class=\"download-name\">" + fileName + "</label><span>&nbsp;&nbsp;&nbsp;&nbsp;大小：" + convertSize(size) + "&nbsp;&nbsp;&nbsp;&nbsp;传输速率：</span><span id=\"speed-" + fileId + "\">0B/s</span>\
                <div class=\"row download-row\">\
                  <div class=\"col-lg-11\">\
                    <div class=\"progress\">\
                      <div id='bar-" + fileId + "' role=\"progressbar\" aria-valuenow=\"0\" aria-valuemin=\"0\" aria-valuemax=\"100\"  class=\"progress-bar progress-bar-striped active\">正在初始化...</div>\
                    </div>\
                  </div>\
                  <div class=\"col-lg-1\">\
                    <button onclick=\"cancelDownloadFile('" + fileId + "')\" class=\"btn btn-danger btn-xs\">取消</button>\
                  </div>\
                </div>\
              </div>";
  $("#downloading-content").append(html);
}

function showSpeed(id, speed) {
  $("#speed-" + id).text(speed + '/s');
}

function setBarValue(id, value) {
  $("#bar-" + id).css("width", Math.ceil(value) + '%');
  $("#bar-" + id).text(value.toFixed(2) + '%');
}

function downloadComplete(fileId, fileName, size) {
  var html = "<div id='downloadBar-" + fileId + "' class=\"downloadingBar\">\
                <label class=\"download-name\">" + fileName + "</label><span>&nbsp;&nbsp;&nbsp;&nbsp;大小：" + convertSize(size) + "</span>\
                <div class=\"row download-row\">\
                  <div class=\"col-lg-11\">\
                    <div class=\"progress\">\
                      <div role=\"progressbar\" aria-valuenow=\"99\" aria-valuemin=\"0\" aria-valuemax=\"100\" style=\"width: 100%\" class=\"progress-bar progress-bar-success progress-bar-striped\">下载完成</div>\
                    </div>\
                  </div>\
                  <div class=\"col-lg-1\">\
                    <button onclick=\"clearBar('" + fileId + "')\" class=\"btn btn-default btn-xs\">清除</button>\
                  </div>\
                </div>\
              </div>";
  $("#downloadingBar-" + fileId).remove();
  $("#download-content").append(html);
}

function clearBar(id) {
  $("#downloadBar-" + id).remove();
}

function showUploadProcess(tempId, fileName, size) {
  var html = "<div id=\"upload-" + tempId + "\"class=\"downloadingBar\">\
                <label id='upload-name-" + tempId + "' class=\"download-name\">正在上传：" + fileName + "</label><span>&nbsp;&nbsp;&nbsp;&nbsp;大小：" + convertSize(size) + "</span>\
                <div class=\"row download-row\">\
                  <div class=\"col-lg-11\">\
                    <div class=\"progress\">\
                      <div id=\"bar-" + tempId + "\" role=\"progressbar\" aria-valuenow=\"99\" aria-valuemin=\"0\" aria-valuemax=\"100\" style=\"width: 0%\" class=\"progress-bar progress-bar-striped active\">正在上传</div>\
                    </div>\
                  </div>\
                  <div class=\"col-lg-1\">\
                    <button id='btn-" + tempId + "' onclick=\"stopUpload(" + tempId + ")\" class=\"btn btn-danger btn-xs\">停止</button>\
                  </div>\
                </div>\
              </div>";
  $("#uploadProcess").append(html);
}

function uploadComplete(tempId, fileName) {
  $("#btn-" + tempId).attr('onclick', "clearUploadBar(" + tempId + ")");
  $("#btn-" + tempId).text("清除");
  $("#upload-name-" + tempId).text("上传完成：" + fileName);
  setBarValue(tempId, 100);
  $("#bar-" + tempId).attr('class', "progress-bar progress-bar-success progress-bar-striped");
}

function clearUploadBar(id) {
  $("#upload-" + id).remove();
}


function showChatRecords(id, start) {
  $("#clearWindow").removeClass("disabled");
  getChatRecords(ME, id, parseInt(start)).then(function (records) {
    var decrypt = new JSEncrypt();
    decrypt.setPrivateKey(privateKey);
    var myPic = $("#myPortrait").attr("src");
    var pic = $("#img" + id).attr("src");
    var html;
    var size = records.length;
    for (var i = 0; i < size; i++) {
      var record = records[i];
      var content = "";
      for (var j = 0; j < record['slice']; j++) {
        content += decrypt.decrypt(record[j]);
      }
      if (record['owner'] == 1) {
        html = "<div class=\"row\"><div class=\"my-photo\"><img src=\"" + myPic + "\" class=\"img-rounded freinds-display\"/></div><div class=\"my-tag\">" +
          strToEmotion(content) + "</div></div>";
      } else {
        html = "<div class=\"row\"><div class=\"friends-photo\"><img src=\"" + pic + "\" class=\"img-rounded freinds-display\"/></div><div class=\"friends-tag\">" + strToEmotion(content) + "</div></div>";
      }
      $("#message-plain").prepend(html);
    }
    if (start == 0) {
      jumpToBottom();
    }
    $("#getMore").remove();
    if (size < 10) {
      noMoreRecord();
    } else {
      iconForGetMore();
      setNextRecords(id, ++start);
    }
  }, function (error) {
    console.log(error);
    noMoreRecord();
  });
}


function jumpToBottom() {
  var h = $("#message-plain")[0].scrollHeight + "px";
  $("#message-plain").animate({scrollTop: h}, 2000);
}

function iconForGetMore() {
  var html = "<div id=\"getMore\" onmouseover='showGetMoreText()' onmouseout='showGetMoreIcon()' >\
              <button><span id=\"getMoreText\" style='display: none'>加载更多</span><span id=\"getMoreIcon\" class=\"glyphicon glyphicon-menu-up\"></span></button>\
            </div>";
  $("#message-plain").prepend(html);
}

function showGetMoreText() {
  $("#getMoreIcon").css("display", "none");
  $("#getMoreText").removeAttr("style");
}

function showGetMoreIcon() {
  $("#getMoreText").css("display", "none");
  $("#getMoreIcon").removeAttr("style");
}

function setNextRecords(id, page) {
  $("#getMore").attr('onclick', "showChatRecords(" + id + "," + page + ")");
}

function noMoreRecord() {
  $("#getMore").remove();
  var html = "<div id=\"getMore\">\
              <button><span id=\"getMoreText\" >无更多记录</span></button>\
            </div>";
  $("#message-plain").prepend(html);

}

function showReturnBottom() {
  var html = "<div id=\"top-window\" onclick=\"removeReturnBottom()\">NEW</div>";
  $("#message-plain").after(html);
  $("#top-window").animate({opacity: 1}, 2000);
}

function removeReturnBottom() {
  $("#top-window").animate({opacity: 0}, 2000);
  jumpToBottom();
  setTimeout(function () {
    $("#top-window").remove();
  }, 2000);
}

function clearWindow(id) {
  $('#message-plain').empty();
  iconForGetMore();
  setNextRecords(id, 0);
  $("#clearWindow").addClass("disabled");
}

function closeConnection(id) {
  if (dataChannels[id] && dataChannels[id].readyState == "open") {
    dataChannels[id].close();
  }
}

function checkConnection(id) {
  var name = $("#nickname" + id).text();
  if (dataChannels[id] && dataChannels[id].readyState == "open") {
    $("#session-title").text("与 " + name + " 聊天中");
    $("#connection-state").text("断开p2p连接");
    $("#closeConnection").attr("onclick", "closeConnection(" + id + ")");
    $("#closeConnection").removeClass("disabled");
  } else {
    var isOnline = ($("#onlineTag-" + id).text() == "[在线]");
    if (isOnline) {
      $("#session-title").text("未与 " + name + " 建立连接");
      $("#connection-state").text("请求连接");
      $("#closeConnection").attr("onclick", "talkWith(" + id + ")");
      $("#closeConnection").removeClass("disabled");
    } else {
      $("#session-title").text(" " + name + " （离线）");
      $("#connection-state").text("对方不在线");
      $("#closeConnection").addClass("disabled");
    }
  }
}

function deleteMessages() {
  var id = $("#session-id").val();
  var name = $("#nickname" + id).text();
  $("#confirmMessage").text("是否删除与用户 " + name + "(id:" + id + ") 的聊天记录？");
  $("#deleteConfirm").attr("onclick", "deleteMessageByUser(" + ME + "," + id + ")");
  $('#confirm').modal('show')
}

function showEmotion() {
  $('#emotion-panel').popover('toggle');
}


function emotionToStr(id) {
  var str = $("#message-content").val();
  str += "[e:" + id + "]";
  $("#message-content").val(str);
}

function strToEmotion(str) {
  //防止注入
  str = str.replace(/\</g, '&lt;');
  str = str.replace(/\>/g, '&gt;');
  str = str.replace(/\n/g, '<br/>');
  //表情代码转换为表情
  str = str.replace(/\[e:([0-9]*)\]/g, '<img src="face/$1.gif" />');
  return str;
}

function keyEvent() {
  if (event.keyCode == 13) {
    var id = parseInt($("#session-id").val());
    sendMessage(id);
  }
}

function setConnectionNotification() {
  var notification = 0;
  for (var i = 0; i < connections.length; i++) {
    notification += unreads[connections[i]];
  }
  notification = notification > 99 ? 99 : notification;
  $("#connectionNum").remove();
  if (notification) {
    var html = "<span id='connectionNum' class='badge'>" + notification + "</span>";
    $("#connectionIcon").after(html);
  }
}

function setNotificationIcon() {
  notificationNum++;
  notificationNum = notificationNum > 99 ? 99 : notificationNum;
  $("#notificationNum").remove();
  if (notificationNum) {
    var html = "<span id='notificationNum' class='badge'>" + notificationNum + "</span>";
    $("#notificationIcon").after(html);
  }
}

function descNotificationIcon() {
  notificationNum--;
  $("#notificationNum").remove();
  if (notificationNum > 0) {
    var html = "<span id='notificationNum' class='badge'>" + notificationNum + "</span>";
    $("#notificationIcon").after(html);
  }
}
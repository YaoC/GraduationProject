var privateKey = null;
var publicKey = null;
var friendsKeys = {};

$(document).ready(function () {
  privateKey = $("#myPrivateKey").val();
  publicKey = $("#myPublicKey").val();


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
  $("#btn-search").attr("disabled","disabled");
  $("#btn-search").text("查找中...");
  var content = $("#ipt-friends").val();
  var showFriendInfo = function (data) {
    console.log(data);
    if(data.code==200){
      console.log(data);
      $("#friends-id").val(data.id);
      $("#friends-nickname").val(data.nickname);
      $("#friends-sex").val((data.sex)?'男':'女');
      $("#friends-birthday").val(data.birthday);
      $("#friends-img").attr('src',data.portrait);
      $("#friends-motto").text(data.motto);
      $("#btn-addFriend").attr('onclick','addFriends('+data.id+')');
      $("#addFriends").modal('hide');
      $("#friend-info").modal('show');
    }
    if(data.code==404){
      $("#addFriends").modal('hide');
      alertInfoDanger("没有此用户");
    }
    $("#btn-search").removeAttr("disabled");
    $("#btn-search").text("查找");
  };
  if(searchValidation==1){
    $.ajax({
      type: "POST",
      url: "/queryById",
      data: {'id':content},
      dataType:'json',
      success:showFriendInfo
    });
  }


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
  $("#p-content").text(name+"(ID："+id+")希望添加你为好友!");
  $("#p-from").text("来自："+name);
  $("#p-time").text(time);
  $("#accept-friend-ask").attr("onclick","acceptFriendsAsk("+id+")");
  $("#reject-friend-ask").attr("onclick","rejectFriendsAsk("+id+")");
  $("#friendAsk").removeAttr("style");
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
  window.setTimeout(function () {
    $("#file-alert-info").empty();
  },5000);
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
  console.log(size);
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


/**
 * Created by cyao on 16-5-9.
 */
//注册验证
var emailValidation,
  nicknameValidation,
  pswValidation;

//登录验证
var email1Validation,
  psw1validation;


function signUp() {

  if(emailValidation&&nicknameValidation&&pswValidation){
    var email = $("#ipt-username").val(),
      nickname = $("#ipt-nickname").val(),
      psw = $("#ipt-psw1").val();
    var pData = {
      "username": email,
      "nickname": nickname,
      "password": SparkMD5.hash(psw)
    };
    $.ajax({
      type: "POST",
      url: "/signup",
      data: pData,
      dataType:'json',
      success:function (data) {
        console.log("return",data);
        if(data.code==200){
          $("#ipt-username1").val(email);
          $("#ipt-password").val(psw);
          validateEmail('username1');
          validatePassword();
          $("#signUp-modal").modal('hide');
          $("#alert-info").append("<div class=\"alert alert-success alert-dismissible\" role=\"alert\">"+
          "<button type=\"button\" class=\"close\" data-dismiss=\"alert\" aria-label=\"Close\">" +
            "<span aria-hidden=\"true\">&times;</span></button>"+
          "<strong>恭喜您已注册成功，赶快登录吧！</strong></div>");
        }else{
          $("#alert-info").append("<div class=\"alert alert-danger alert-dismissible\" role=\"alert\">"+
            "<button type=\"button\" class=\"close\" data-dismiss=\"alert\" aria-label=\"Close\">" +
            "<span aria-hidden=\"true\">&times;</span></button>"+
            "<strong>修改失败，请稍后重试...</strong></div>");
        }
      }
    });
  }
}

function signIn() {
  if(email1Validation&&psw1Validation){
    $("#btn-signin").attr("disabled","disabled");
    $("#btn-signin").text("登录中...");
    var email = $("#ipt-username1").val(),
      psw = SparkMD5.hash($("#ipt-password").val());
    var pData = {
      "username": email,
      "password": psw
    };
    $.ajax({
      type: "POST",
      url: "/signin",
      data: pData,
      dataType:'json',
      success:function (data) {
        console.log("return",data);
        if(data.code==200){
          location.href="/main";
        }else{
          if(data.code==404)
            showError("username1",data.msg);
          if(data.code==405)
            showError("password",data.msg);
        }
        $("#btn-signin").attr("disabled",false);
      }
    });
  }

}





function validateEmail(id) {
  var email = $("#ipt-"+id).val();
  var filter  = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;
  if(!filter.test(email)){
    showError(id,"邮箱格式错误，请重新输入");
    if(id=="username")
      emailValidation = false;
    if(id=="username1")
      email1Validation = false;
    return false;
  }
  if(email.length>40){
    showWarning(id,"输入的邮箱过长，请重新输入");
    if(id=="username")
      emailValidation = false;
    if(id=="username1")
      email1Validation = false;
    return false;
  }
  if(id=="username")
    emailValidation = true;
  if(id=="username1")
    email1Validation = true;
  showSuccess(id);
}



function validateNickname() {
  var nickname = $("#ipt-nickname").val();
  if(nickname.length<2){
    showWarning("nickname","输入的昵称过短，请重新输入");
    nicknameValidation = false;
    return false;
  }
  if(nickname.length>10){
    showWarning("nickname","输入的昵称过长，请重新输入");
    nicknameValidation = false;
    return false;
  }
  nicknameValidation = true;
  showSuccess("nickname");
}


function validatePassword1() {
  var psw = $("#ipt-psw1").val();
  if(psw.length<6){
    showWarning("psw1","输入的密码过短，请重新输入");
    return false;
  }
  showSuccess("psw1");
}

function validatePassword2() {
  var psw1 = $("#ipt-psw1").val();
  var psw2 = $("#ipt-psw2").val();
  if(psw1!=psw2){
    showError("psw2","");
    showError("psw2","密码不一致");
    pswValidation = false;
    return false;
  }
  pswValidation = true;
  showSuccess("psw2");
}


function validatePassword() {
  var password = $("#ipt-password").val();
  if(password.length<6){
    showWarning("password","输入的密码过短，请重新输入");
    psw1Validation = false;
    return false;
  }
  psw1Validation = true;
  showSuccess("password");
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

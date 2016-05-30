// dao/userDao.js
// 实现与MySQL交互
var mysql = require('mysql');
var $conf = require('../conf/db');
var $sql = require('./userSqlMapping');
var $userInfo = require("./userInfoSqlMapping");
var md5 = require('md5');

var redisDao = require('./redisDao');
var bluebird = require("bluebird");
bluebird.promisifyAll(redisDao);

var NodeRSA = require('node-rsa');

// 使用连接池，提升性能
var pool  = mysql.createPool($conf.mysql);

// 向前台返回JSON方法的简单封装
var jsonWrite = function (res, ret) {
  if(typeof ret === 'undefined') {
    res.json({
      code:'1',
      msg: '操作失败'
    });
  } else {
    res.json(ret);
  }
};

module.exports = {
  add: function (req, res, next) {
    pool.getConnection(function(err, connection) {
      // 获取前台页面传过来的参数
      var param = req.body;
      var filter  = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;
      if (!filter.test(param.username)){
        //用户名不符合邮箱格式
        var error ={
          code:2,
          msg:'邮箱格式错误'
        };
        jsonWrite(res,error);
        return 0;
      }
      
      connection.query($sql.isOnly,param.username,function (err,result) {
        if(result.length){
          result = {
            code: 3,
            msg:'该邮箱已被使用'
          };
          jsonWrite(res, result);
        }else{
          // 建立连接，向表中插入值
          var timeStamp = Date.parse(new Date);
          var psw = md5(param.password+timeStamp);
          console.log("password",psw);
          connection.query($sql.insert, [param.username,psw ,timeStamp], function(err, result) {
            if(result) {
              var uid = result.insertId;
              redisDao.addNickName(uid,param.nickname);
              var key = new NodeRSA({b: 512});
              var privateKey = key.exportKey("private");
              var publicKey = key.exportKey("public");
              connection.query($userInfo.insert, [uid,0,'1990-01-01','1234567890',privateKey,publicKey], function(err, result) {
                if(result) {
                  result = {
                    code: 200,
                    msg:'注册成功'
                  };
                  // 以json形式，把操作结果返回给前台页面
                  jsonWrite(res, result);
                }
                // 释放连接
                connection.release();
              });
            }
          });
        }
      });
    });
  },

  signin: function (req,res,next) {
    pool.getConnection(function(err, connection) {
      // 获取前台页面传过来的参数
      var param = req.body;
      console.log(param);
      // 建立连接，查询用户
      connection.query($sql.signIn, param.username, function(err, result) {
        if(result.length){
          var userId = result[0].user_id;
          var regTime = result[0].regTime;
          var psw = md5(param.password+regTime);
          if(psw==result[0].password){
            var userName = "点此修改个人信息";
            redisDao.getNickName(userId).then(function (nickname) {
              if(nickname)
                userName = nickname;
              req.session.userId = userId;
              req.session.userName = userName;
              result = {
                "code": 200,
                'msg': "登录成功"
              };
              jsonWrite(res, result);
              // 释放连接
              connection.release();
            });
          }else{
            result = {
              "code": 405,
              'msg': "密码错误"
            };
            jsonWrite(res, result);
            // 释放连接
            connection.release();
          }
        }else{
          result = {
            "code": 404,
            'msg': "用户不存在"
          };
          jsonWrite(res, result);
          // 释放连接
          connection.release();
        }
      });
    });
  },
  
  editUserInfo: function (req,res,next) {
    pool.getConnection(function (err,connection) {
      var userId = req.session.userId;
      var param = req.body;
      console.log("param",param);
      connection.query($userInfo.insert,[userId,param.sex,param.birthday,param.phone,null,null], function(err, result) {
        if(result==undefined){
          console.log(err);
          result = {
            "code": 406,
            'msg': "修改个人信息错误"
          };
        }
        else{
          redisDao.addNickName(userId,param.nickname);
          redisDao.addMotto(userId,param.motto);
          req.session.userName = param.nickname;
          result = {
            "code": 200,
            'msg': "修改信息成功"
          };
        }
        jsonWrite(res, result);
        connection.release();
      });
    });
  },
  showMyInfo: function (req, res, next) {
    pool.getConnection(function (err,connection) {
      var userId = req.session.userId;
      connection.query($userInfo.queryById,userId, function(err,result){
        var info;
        console.log(result);
        if(!result.length){
          info = {
            'sex':0
          };
        }else{
          info = result[0];
        }
        redisDao.getFriendInfo(userId).then(function (me) {
          info['display'] = me['portrait'] || 'http://i4.buimg.com/6b2fade4a2d1b576.jpg';
          info['motto'] = me['motto'] || '点此添加签名';
          res.render('main', {
            title: 'Main',
            userId: req.session.userId,
            userName: req.session.userName,
            userInfo: info
          });
        });
        connection.release();
      });
    });
  },

  searchInfo: function (req, res, next) {
    var id = req.body.id;
    console.log(req.body.id);
    if(id){
      pool.getConnection(function (err,connection) {
        connection.query($userInfo.queryById,id, function(err,result){
          if(result.length){
            var data = result[0];
            delete  data['phone'];
            delete data['private_key'];
            delete data['public_key'];
            redisDao.getNickName(id).then(function (nickname) {
              data['nickname'] = nickname||'该用户未设置昵称';
              redisDao.getPortrait(id).then(function (portrait) {
                data['portrait'] = portrait||'http://i4.buimg.com/6b2fade4a2d1b576.jpg';
                data['code']  = 200;
                jsonWrite(res, data);
              });
            });
          }else{
            //查无此人
            var data = {
              'code': 404
            };
            jsonWrite(res, data);
          }
          connection.release();
        });
      });
    }else{
      //消息传输错误
      var data = {
        'code': 500
      };
      jsonWrite(res, data);
    }
  }
};
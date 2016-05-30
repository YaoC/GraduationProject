var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var RedisStore = require('connect-redis')(session);
var bodyParser = require('body-parser');

var routes = require('./routes/index');
var users = require('./routes/users');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

//session
var store = new RedisStore({
    host: "localhost",
    port: 6379
});
var sessionMiddleware = session({
  store: store,
  resave:false,
  cookie: {maxAge: 604800000 }, //session保存7天
  saveUninitialized:false,
  secret: 'exciting'
});
app.use(sessionMiddleware);


app.use('/', routes);
app.use('/users', users);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

var server = require('http').createServer(app);
//引入socket.io模块并绑定到服务器
var io = require('socket.io').listen(server); 
server.listen(3000);




/*************************socket部分************************************/
/**
 * redis
 * -------key-------|-----type-------|-----描述-------------------
 *   onlineUsers    |     set        |  在线用户集合                
 *   file:md5       |     set        |  拥有该md5值文件的在线用户集合
 * -----------------|----------------|----------------------------
 * 
 */

var redisDao = require('./dao/redisDao');
var sockets = {};



/**
 * [在socket.io中使用session]
 */
io.use(function(socket, next) {
    sessionMiddleware(socket.request, socket.request.res, next);
});

io.on('connection', function(socket) {
  /**
   * [userId 与服务器建立ws连接的用户的id]
   */
  var userId = socket.request.session.userId||0;
  if(userId){
    console.log("用户："+userId+"建立连接...");
    redisDao.userOnline(userId);
    sockets[userId] = socket;
    redisDao.getFriends(userId).then(function (data) {
      if(data.length){
        data.forEach(function (user) {
          redisDao.getFriendInfo(user).then(function (info) {
            socket.emit('newFriend',info);
          });
        });
      }
    });
    redisDao.getFriendsAsk(userId).then(function (data) {
      if(data.length){
        data.forEach(function (user,i) {
          redisDao.getNickName(user).then(function (nickname) {
            socket.emit('friendsAsk',{
              'id':user,
              'name': nickname
            });
          });
        });
      }
    });
  }

     
	socket.on('letsTalk',function(data){
    /**
     * [friendsId 希望建立连接的对方用户id]
     */
		var friendsId = parseInt(data['to']);
			if (redisDao.isUserOnline(friendsId)) {
        var message = {
          'from': userId,
          'description': data['description'],
          'isChat': data['isChat']
        };
				sockets[friendsId].emit('offer',message);
			}
	});

	socket.on('okLetsTalk',function (data) {
		var friendsId = parseInt(data['to']);
      if (redisDao.isUserOnline(friendsId)) {
        var message = {
          'from': userId,
          'description':data['description']
        };
		    sockets[friendsId].emit('answer',message);
      }
	});


	socket.on('candidate',function(data){
		var friendsId = parseInt(data['to']);
    var message = {
      'from':userId,
      'candidate':data['candidate']
    };
		sockets[friendsId].emit('candidate',message);	
	});

	socket.on('disconnect', function(){
        redisDao.deleteAllFileByUser(userId);
        redisDao.userOffline(userId);
		delete(sockets[userId]);
		console.log("disconnected");
	});

  socket.on('addFile',function (file) {
    redisDao.addFile(userId,file);

  });

  socket.on('deleteFile',function (fileId) {    
    redisDao.deleteFile(userId,fileId);
  });

  socket.on("searchFile", function (md5) {
    redisDao.searchFile(md5).then(function (info) {
      socket.emit("serachFileResult", info);
    }, function (error) {
      socket.emit("searchFileError", error);
    });
  });


/***************************好友关系部分*********************************/
    /**
     * 好友请求保存在reids中 askof userId : Set{my friends ask}
     * 好友关系保存在redis中 friendsof userId : Set{my friends}
     */


  socket.on('addFriends',function (friendId) {
      if(userId!=friendId){
        //将自己的id添加到对方的好友请求列表中
        redisDao.addFriendsAsk(friendId,userId);
        //对方在线则立即告知
        if (redisDao.isUserOnline(friendId)){
          var message = {
            'id':userId,
            'name': socket.request.session.userName
          };
          sockets[friendId].emit('friendsAsk',message);
        }
      }
  });

  socket.on('acceptFriendsAsk',function (friendId) {
      //检查对方是否有加我为好友的请求
      if(redisDao.isFriendsAskExists(userId,friendId)&&(userId!=friendId)){
          redisDao.addFriendsRelationship(userId,friendId);
          redisDao.deleteFriendsAsk(userId,friendId);
      }
  });

  socket.on('rejectFriendsAsk',function (friendId) {
    //检查对方是否有加我为好友的请求
    if(redisDao.isFriendsAskExists(userId,friendId)){
      redisDao.deleteFriendsAsk(userId,friendId);
    }
  });
  
});

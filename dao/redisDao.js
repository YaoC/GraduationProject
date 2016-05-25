/**
 * [redis 使用redis保存数据]
 */
var redis = require("redis"),
    client = redis.createClient();
var Promise = require("bluebird");

module.exports = {
	userOnline: function (uid) {
		client.sadd("onlineUsers", uid, redis.print);
	},
	isUserOnline: function (uid) {
		return client.sismember("onlineUsers", uid);
	},
	userOffline: function (uid) {
		client.srem("onlineUsers", uid, redis.print);
	},
	addFile: function (uid,file) {

		client.sadd("file:"+file['id'], uid, redis.print);
    	client.sadd("user:"+uid, file['id'], redis.print);
		client.hsetnx("file-name",file['id'], file['name'], redis.print);
		// client.hincrby("file-count",file['id'],1,redis.print);
	},
	deleteFile: function (uid,fid) {
		client.srem("file:"+fid, uid, redis.print);
    	client.srem("user:"+uid, fid, redis.print);
		client.hincrby("file-count",fid,-1,redis.print);
		if(!client.exists("file:"+fid)){
			client.hdel("file-name",fid,redis.print);
		}
	},
	deleteAllFileByUser: function (uid) {
		client.smembers("user:"+uid,function (err, replies) {
			replies.forEach(function (reply, i) {
				client.srem("file:"+reply,uid,redis.print);
				if(!client.exists("file:"+reply)){
					client.hdel("file-name",reply,redis.print);
				}
				console.log("remove "+uid+" from file:"+reply);
				client.del("user:"+uid);
			});
		});
	},
	addFriendsAsk: function (uid,fid) {
		client.sadd("askof:"+uid,fid,redis.print);
	},
  getFriendsAsk:function (uid) {
    return new Promise(function (resolve, reject) {
      client.smembers("askof:"+uid,function (err,replies) {
        resolve(replies);
      })
    });
  },
  getFriends:function (uid) {
    return new Promise(function (resolve, reject) {
      client.smembers("friendsof:"+uid,function (err,replies) {
        resolve(replies);
      })
    });
  },
	isFriendsAskExists:function (uid,fid) {
		return client.sismember("askof:"+uid, fid);
	},
	deleteFriendsAsk:function (uid,fid) {
		client.srem("askof:"+uid, fid,redis.print);
	},
	addFriendsRelationship:function (uid1,uid2) {
		client.sadd('friendsof:'+uid1,uid2,redis.print);
		client.sadd('friendsof:'+uid2,uid1,redis.print);
	},
  addNickName: function (uid,nickname) {
    client.hsetnx("info:"+uid,'nickname', nickname, redis.print);
  },
  addMotto: function (uid,motto) {
    client.hsetnx("info:"+uid,'motto', motto, redis.print);
  },
  getNickName: function (uid) {
    return new Promise(function(resolve, reject){
      client.hget("info:"+uid,'nickname',function (err, reply) {
        resolve(reply);
      });
    });
  },
  editPortrait: function (uid,link) {
    client.hset("info:"+uid,"portrait",link);
  },
  getPortrait: function (uid) {
    return new Promise(function(resolve, reject){
      client.hget("info:"+uid,"portrait",function (err, reply) {
        resolve(reply);
      });
    });
  },
  addUserInfo: function (uid,nickname,portrait,motto) {
    client.hmset("info:"+uid,"nickname",nickname,"portrait",portrait,"motto",motto);
  },
  getFriendInfo: function (uid) {
    return new Promise(function (resolve,reject) {
      client.hgetall("info:"+uid,function (err,info) {
        info['id'] = uid;
        resolve(info);
      });
    });
  }
};



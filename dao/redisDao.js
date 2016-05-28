/**
 * [redis 使用redis保存数据]
 */
var redis = require("redis"),
    client = redis.createClient();
var Promise = require("bluebird");

module.exports = {
	userOnline: function (uid) {
    client.sadd("onlineUsers", uid);
	},
	isUserOnline: function (uid) {
		return client.sismember("onlineUsers", uid);
	},
	userOffline: function (uid) {
    client.srem("onlineUsers", uid);
	},
	addFile: function (uid,file) {

    client.sadd("file:" + file['id'], uid);
    client.sadd("user:" + uid, file['id']);
    client.hsetnx("file-name", file['id'], file['name']);
    // client.hincrby("file-count",file['id'],1);
	},
	deleteFile: function (uid,fid) {
    client.srem("file:" + fid, uid);
    client.srem("user:" + uid, fid);
    client.hincrby("file-count", fid, -1);
		if(!client.exists("file:"+fid)){
      client.hdel("file-name", fid);
		}
	},
	deleteAllFileByUser: function (uid) {
		client.smembers("user:"+uid,function (err, replies) {
			replies.forEach(function (reply, i) {
        client.srem("file:" + reply, uid);
				if(!client.exists("file:"+reply)){
          client.hdel("file-name", reply);
				}
				console.log("remove "+uid+" from file:"+reply);
				client.del("user:"+uid);
			});
		});
	},
	addFriendsAsk: function (uid,fid) {
    client.sadd("askof:" + uid, fid);
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
    client.srem("askof:" + uid, fid);
	},
	addFriendsRelationship:function (uid1,uid2) {
    client.sadd('friendsof:' + uid1, uid2);
    client.sadd('friendsof:' + uid2, uid1);
	},
  addNickName: function (uid,nickname) {
    client.hset("info:" + uid, 'nickname', nickname);
  },
  addMotto: function (uid,motto) {
    client.hset("info:" + uid, 'motto', motto);
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
  },
  searchFile: function (id) {
    return new Promise(function (resolve, reject) {
      var info = {};
      client.hget("file-name", id, function (err, reply) {
        if (reply) {
          info['name'] = reply;
          client.smembers("file:" + id, function (err, replies) {
            if (replies.length) {
              info['id'] = id;
              info['users'] = replies;
              resolve(info);
            } else {
              reject("The owner of this file is offline.");
            }
          })
        } else {
          reject("No such file.");
        }
      });
    });
  }
};



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
    return new Promise(function (resolve, reject) {
      client.sismember("onlineUsers", uid, function (err, isOnline) {
        resolve(isOnline);
      });
    });
	},
  getAllOnlineUsers: function () {
    return new Promise(function (resolve, reject) {
      client.smembers("onlineUsers", function (err, replies) {
        resolve(replies);
      });
    });
  },
	userOffline: function (uid) {
    client.srem("onlineUsers", uid);
	},
	addFile: function (uid,file) {

    client.sadd("file:" + file['id'], uid);
    client.sadd("user:" + uid, file['id']);
    client.setnx("file-info:" + file['id'], JSON.stringify(file));
    // client.hsetnx("file-name", file['id'], file['name']);

	},
	deleteFile: function (uid,fid) {
    client.srem("file:" + fid, uid);
    client.srem("user:" + uid, fid);
	},
	deleteAllFileByUser: function (uid) {
		client.smembers("user:"+uid,function (err, replies) {
			replies.forEach(function (reply, i) {
        client.srem("file:" + reply, uid);
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
      client.get("file-info:" + id, function (err, reply) {
        if (reply) {
          var info = JSON.parse(reply);
          client.smembers("file:" + id, function (err, replies) {
            if (replies.length) {
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



//保存所有与本地相连的peer connection， 键为对方id，值为RTCPeerConnection类型
var peerConnections = {};
//保存所有与本地连接的dataChannel,键为对方id,值为dataChannel类型
var dataChannels = {};
var connections = [];
var pc;
var dataChannel;

// var ID_temp;

// 设置iceserver
// var webrtcDetectedBrowser = "Chrome";
// if(navigator.userAgent.indexOf("Firefox")>0){
// 	webrtcDetectedBrowser = "Firefox";
// }
// var configuration;
// if (webrtcDetectedBrowser === 'Firefox') {
//     configuration = {
//         'iceServers': [{
//             'url': 'stun:23.21.150.121'
//         }]
//     };
// } else {
//     configuration = {
//         'iceServers': [{
//             // 'url': 'stun:stun.l.google.com:19302'
//             'url': 'stun:stun.sipgate.net'
//         }]
//     };
// }
// 
var configuration = {
        'iceServers': [{
            // 'url': 'stun:stun.l.google.com:19302'
            'url': 'stun:stun.sipgate.net'
      	}]
};

var sdpConstraints = {
    'mandatory': {
        'OfferToReceiveAudio': false,
        'OfferToReceiveVideo': false
    }
};




/********************************WebSocket**********************************/
//与服务器建立Web Socket连接
var socket = io.connect();

//向服务器发送当前用户的信息
// function connect(name,id) {
// 	console.log(name+" "+id);	
// 	socket.emit('connectById', id);
// }


// socket.on('connection', function(evt){
// 	ID_temp = evt;
// 	console.log('your ID is ' + ID_temp);
// });

function join(friendsId) {
	start (true,friendsId) ;
}



socket.on('offer', function(data){
	var friendsID = data['from'];
	if (!pc) {
		start(false,friendsID);	
		console.log('pc create in offer');
	}	
	var desc = JSON.parse(JSON.stringify(data['description']));
	var sdp = new RTCSessionDescription();
	sdp.type = 'offer';
	sdp.sdp = desc['sdp'];
	console.log('offer:remoteDescription:');
	console.log(sdp)
	pc.setRemoteDescription(sdp).then(function () {
		return pc.createAnswer(); 
	})
	.then(function (answer) {
		return pc.setLocalDescription(answer);
	})
	.then(function () {
		var message = {
		'to': friendsID,
		'description':pc.localDescription
		};
		connections.push(friendsID);
		console.log('in offer:');
		console.log(connections);
		peerConnections[friendsID]  = pc;
		pc = null;
		socket.emit('okLetsTalk',message);
	})
	.catch(logError);
});

socket.on('answer', function(data){
	var friendsId = data['from'];
	if (!pc) {
		start(false,friendsId);	
		console.log('pc create in answer');
	}	
	var desc = JSON.parse(JSON.stringify(data['description']));
	var sdp = new RTCSessionDescription();
	sdp.type = 'answer';
	sdp.sdp = desc['sdp'];
	console.log('answer:remoteDescription:');
	console.log(sdp)
	pc.setRemoteDescription(sdp).catch(logError);
	connections.push(friendsId);
	console.log('in answer:');
	console.log(connections);
	peerConnections[friendsId]  = pc;
	pc = null;
});


socket.on('candidate',function (data) {
	candidate = new RTCIceCandidate(data['candidate']);
	friendsId = data['from'];
	console.log(candidate);
	if(friendsId in peerConnections)
		peerConnections[friendsId].addIceCandidate(candidate).catch(logError);
});

socket.on('disconnect', function(){
	console.log("disconnected!");
});


/**************************RTCPeerConnection********************************/



function start (isInitiator,friendsId) {
	pc = new RTCPeerConnection(configuration);
  	// send any ice candidates to the other peer
	
	pc.onicecandidate = function (evt) {
		console.log('candidate: ');
		console.log(evt);
		if (friendsId) {
			var message = {
			'to':friendsId,
			'candidate':evt.candidate
			};
			if (evt.candidate)
				socket.emit('candidate',message);
		}
	};
  	// let the 'negotiationneeded' event trigger offer generation
  	pc.onnegotiationneeded = function () {
  		console.log('negotiationneeded event ');
    		pc.createOffer().then(function (offer) {
    			console.log(offer);
    			 return pc.setLocalDescription(offer); 
    		})
    		.then(function () {
    			if (friendsId) {
		  		var message = {
	    				'to':friendsId,
	    				'description':pc.localDescription
	    			};
	    			socket.emit('letsTalk',message);
  			}
    		})
    		.catch(logError);
  	};
  	if(isInitiator){
		// create data channel and setup chat
		dataChannel = pc.createDataChannel("chat");
		dataChannels[friendsId] = dataChannel;
		setupChat(friendsId);
    openSession(friendsId);
	} else {
		// setup chat on incoming data channel
		pc.ondatachannel = function (evt) {
			dataChannels[friendsId] = evt.channel;
			setupChat(friendsId);
		};
  }
}





function setupChat(id){
	dataChannels[id].onopen = function () {
    addConnection(id);
		console.log('channel open');

	};

    	dataChannels[id].onmessage = function (evt) {
        //TODO RSA加密解密 http://www-cs-students.stanford.edu/~tjw/jsbn/
    		var message = JSON.parse(evt.data);
    		if(message['tag']=='chat'){
          handleChat(id,message['content']);
        }

    		//else if(message['tag'] == 'file' )

    	};
    	dataChannels[id].onclose = function () {
    		delete(dataChannels[id]);
    		delete(peerConnections[id]);
    		connections.splice(id,1);
    		console.log(id+' disconnected !');
        removeConnection(id);
    	}
}

function send(id,msg) {

	var message = {
		'tag':'chat',
		'content':msg
	};
	dataChannels[id].send(JSON.stringify(message));
}





function logError(error) {
  console.log(error.name + ': ' + error.message);
}


/****************************IndexedDB 操作部分****************************************/
var idbSuccess = function (event) {
	console.log("MyFileDataBase created/open successfully !");
	var db = event.target.result;
	var transaction = db.transaction(["files"], "readwrite");
	var objectStore = transaction.objectStore("files");
	var request = objectStore.getAll();
	request.onsuccess = function (e) {
		var files = e.target.result;
		for (var i = 0; i < files.length; i++) {
			var file = files[i];
            var data = {
                'id':file['id'],
                'name':file['name']
            };
	    	socket.emit('addFile',data);
		}
	}
};
var idbError = function (event) {
	console.log("Fail to create/open MyFileDataBase: "+event.target.errorCode);
};
/**
 * [初始化数据库]
 */
$(document).ready(function() { 
	if(!window.indexedDB) {
		console.log("Sorry! Your browser don't support IndexedDB");
		return ;
	}
	var request = indexedDB.open("MyFileDataBase",1);
	request.onsuccess = idbSuccess;
	request.onerror = idbError;
	request.onupgradeneeded = function(event){
		var db = event.target.result;
		if (!db.objectStoreNames.contains('files')) {
			db.createObjectStore('files', {
				keyPath: "id"
			});
		}

	};
	
}); 

/**
 * [addFile 用户将自己的一个文件的文件信息保存到本地数据库中供其它用户下载]
 */
function addFile(){
	if(!window.indexedDB) {
		console.log("Sorry! Your browser don't support IndexedDB");
		return ;
	}
	var file = document.getElementById("file").files[0];
	var fileName = file.name;
	if(!file){
		console.log("No file !");
		return false;
	}
	getMd5(file).then(function(md_5){
		var data = {
		'id': md_5,
        'name': fileName,
		'file': file
		};
		console.log(data);
		var req = indexedDB.open("MyFileDataBase",1);
		req.onerror = idbError;
		req.onsuccess = function (event) {
			db = event.target.result;
			var transaction = db.transaction(["files"], "readwrite");
			transaction.onerror = function (event) {
				console.log("Fail to add file : "+event.target.errorCode);
			}
			transaction.oncomplete = function (event) {
				console.log("complete !");
			}
			var objectStore = transaction.objectStore("files");
			var request = objectStore.add(data);
			request.onsuccess = function(event) {
		    	console.log("Add file successfully !");
                var fileInfo = {
                    'id': md_5,
                    'name': fileName
                };
		    	socket.emit('addFile',fileInfo);
		  	};
		}	
	});
}



/**
 * [getFile 按id查询本地数据库中的文件信息]
 * @param  {[type]} id [文件的md5值]
 * @return {[type]}    [resolve:成功查询到并返回文件信息 reject:未查到文件信息]
 */
function getFile(id) {
	return new Promise(function (resolve,reject) {
		var request = window.indexedDB.open("MyFileDataBase", 1);
		request.onerror = function(e) {
			console.log(e.currentTarget.error.message);
		};
		request.onsuccess = function(e) {
			var db = e.target.result;
			var transaction = db.transaction(["files"], "readonly");
			var store = transaction.objectStore("files");
			var req = store.get(id);
			req.onsuccess = function(e) {
				if(e.target.result)
					resolve(e.target.result);//promise
				else
					reject("Can't find this file !");
			};
		};
	});
}

/**
 * [deleteFile 按id删除文件信息]
 * @param  {[type]} id [MD5值]
 */
function deleteFile(id) {
	var request = window.indexedDB.open("MyFileDataBase", 1);
	request.onerror = function(e) {
		console.log(e.currentTarget.error.message);
	};
	request.onsuccess = function(e) {
		var db = e.target.result;
		var transaction = db.transaction(["files"], "readwrite");
		var store = transaction.objectStore("files");
		var req = store.delete(id);
		req.onsuccess = function (e) {
			console.log("file delete !");
			socket.emit('deleteFile',id);
		}
		req.onerror = function (e) {
			console.log("delete error !");
		}
	};				
}

/**
 * [deleteAll 删除所有文件信息]
 */
function deleteAll(){
	var request = window.indexedDB.open("MyFileDataBase", 1);
	request.onerror = function(e) {
		console.log(e.currentTarget.error.message);
	};
	request.onsuccess = function(e) {
		var db = e.target.result;
		var transaction = db.transaction(["files"], "readwrite");
		var store = transaction.objectStore("files");
		var req = store.clear();
		req.onsuccess = function (e) {
			console.log("files delete !");
		}
		req.onerror = function (e) {
			console.log("delete error !");
		}
	};				
}

/**************************************文件操作部分**********************************************/

/**
 * 获取文件的MD5值
 * @return {[type]}
 */		
function getMd5(file) {
	return new Promise(function (resolve,reject) {
		// var file = document.getElementById("file").files[0];
		var blobSlice = File.prototype.slice || File.prototype.mozSlice || File.prototype.webkitSlice,
		chunkSize = 2097152, // read in chunks of 2MB
		chunks = Math.ceil(file.size / chunkSize),
		currentChunk = 0,
		spark = new SparkMD5.ArrayBuffer(),
		frOnload = function(e){
			console.log("read "+Math.ceil(currentChunk/chunks*10000)/100+"% of this file ...");
			spark.append(e.target.result); // append array buffer
			currentChunk++;
			if (currentChunk < chunks)
				loadNext();
			else{
				var md_5 = spark.end();
				console.log("read 100% of this file !");
				resolve(md_5);//Promise
			}
		},
		frOnerror = function () {
			console.log("\noops, something went wrong.");
		};
		function loadNext() {
			var fileReader = new FileReader();
			fileReader.onload = frOnload;
			fileReader.onerror = frOnerror;
			var start = currentChunk * chunkSize,
				end = ((start + chunkSize) >= file.size) ? file.size : start + chunkSize;
			fileReader.readAsArrayBuffer(blobSlice.call(file, start, end));
		};
		console.log("file name: "+file.name+" ("+file.size.toString().replace(/\B(?=(?:\d{3})+(?!\d))/g, ',')+" bytes)\n");
		loadNext();
	});
}

function fileSlice(file) {
	var blobSlice = File.prototype.slice || File.prototype.mozSlice || File.prototype.webkitSlice,
		chunkSize = 2097152;// read in chunks of 2MB
	var fileReader = new FileReader();
	fileReader.onload = function (e) {
		console.log(e.target.result);
	};
	fileReader.readAsBinaryString(blobSlice.call(file, 0, 50));
}

function showFileInfo(id) {
	getFile(id).then(function (data) {
		console.log(data.file);
	},function (error) {
		console.log(error);
	});
}


/**
 * 添加好友
 * @param friendId 好友id
 */
function addFriends(friendId) {
	socket.emit('addFriends',friendId);
}

socket.on('friendsAsk',function (data) {
  var temp = new Date();
  var time = temp.getFullYear()+"-"+(temp.getMonth()+1)+"-"+temp.getDate()+" "+temp.getHours()+":"+
    temp.getMinutes()+":"+temp.getSeconds();
  //将加好友的消息加入到通知队列中
  var html = "<button class=\"content-btn btn btn-block\" onclick=\"showFriendAsk("+
    data['id']+",\'"+data['name']+"\',\'"+time+"\')\"><div class=\"content-header\">好友请求 </div><div class=\"content-message\">用户"+
    data['name']+"（ID："+data['id']+"）希望添加你为好友</div></button>";
  $("#notification-content").append(html);

});

function acceptFriendsAsk(friendId) {
	socket.emit('acceptFriendsAsk',friendId);
  removeWindow('friendAsk');
}

function rejectFriendsAsk(friendId){
  socket.emit('rejectFriendsAsk',friendId);
  removeWindow('friendAsk');
}


socket.on('newFriend',function (info) {
  if(info){
    var html = "<button class=\"content-btn btn btn-block\" onclick=\"talkWith("+info['id']+",'"+info['nickname']+"','"+info['portrait']+"')\" ><div class=\"list-left\"><img id=\"img"+info['id']+"\" src="+info["portrait"]
      +" class=\"img-rounded freinds-display\"/></div><div class=\"list-right\"><div id=\"nickname"+info['id']+"\" class=\"content-header\">"+info["nickname"]
      +"</div><div class=\"content-message\">"+info["motto"]+"</div></div></button>";
    $("#friends").append(html);
  }
});

function talkWith(id,name,pic) {
  if(dataChannels[id]){
    openSession(id,name,pic);
  }else{
    join(id);
  }


}


function openSession(id) {
  var name = $("#nickname"+id).text();
  $("#session").removeAttr("style");
  $("#session-id").val(id);
  $("#session-title").text("与 "+name+" 聊天中");
  $("#message-send").attr("onclick","sendMessage("+id+")");
  var pic = $("#img"+id).attr("src");
  $("#friend-pic").val(pic);
}

function addConnection(id) {
  var name = $("#nickname"+id).text();
  var pic = $("#img"+id).attr("src");
  var html = "<button id=\"friendsSession-"+id+"\" class=\"content-btn btn btn-block\" onclick=\"openSession("+id+")\"><div class=\"list-left\"><img class=\"img-rounded freinds-display\" src=\""+pic+"\" /></div>"+
    "<div class=\"list-right\"><div class=\"content-header\">"+name+"</div><div id=\"friendMessage"+id+"\" class=\"content-message\">已建立连接，可开始聊天！</div></div></button>";
  $("#session-bar").append(html);
}

function removeConnection(id) {
  $("#friendsSession-"+id).remove();
}

function sendMessage(id){
  var content = $("#message-content").val();
  if(content){
    var pic = $("#myPortrait").attr("src");
    var html = "<div class=\"row\"><div class=\"my-photo\"><img src=\""+pic+"\" class=\"img-rounded freinds-display\"/></div><div class=\"my-tag\">"+
      content+"</div></div>";
    send(id,content);
    $("#friendMessage"+id).text("[我]："+content.substring(0,15));
    $("#message-plain").append(html);
    $("#message-content").val("");
  }
}


function handleChat(id,content) {
  $("#friendMessage"+id).text(content.substring(0,15));
  if($("#session").css("display")=="block"&&$("#session-id").val()==id){
    var pic = $("#friend-pic").val();
    var html = "<div class=\"row\"><div class=\"friends-photo\"><img src=\""+pic+"\" class=\"img-rounded freinds-display\"/></div><div class=\"friends-tag\">"+content+"</div></div>";
    $("#message-plain").append(html);
  }else{
    //TODO 储存到Indexed DB
  }
}
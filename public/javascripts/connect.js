var ME = 0;
//保存所有与本地相连的peer connection， 键为对方id，值为RTCPeerConnection类型
var peerConnections = {};
//保存所有与本地连接的dataChannel,键为对方id,值为dataChannel类型
var dataChannels = {};
var connections = [];
var pc;
var dataChannel;
//fileForm 保存拥有某文件的用户数组
var fileFrom = {};

var receiveFiles = {};
var mergingFiles = {};

var uploadFlag = {};
//必须能被24整除
const blockSize = 10493952;
const chunkSize = 20496;


var configuration = {
  'iceServers': [{
    'url': 'stun:stun.sipgate.net'
  }]
};

/********************************WebSocket**********************************/
//与服务器建立Web Socket连接
var socket = io.connect();

function join(friendsId) {
  start(true, friendsId, 1);
}

socket.on('offer', function(data){
	var friendsID = data['from'];
  var isChat = data['isChat'];
	if (!pc) {
    start(false, friendsID, isChat);
		console.log('pc create in offer');
	}	
	var desc = JSON.parse(JSON.stringify(data['description']));
	var sdp = new RTCSessionDescription();
	sdp.type = 'offer';
	sdp.sdp = desc['sdp'];
	console.log('offer:remoteDescription:');
  console.log(sdp);
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
	var desc = JSON.parse(JSON.stringify(data['description']));
	var sdp = new RTCSessionDescription();
	sdp.type = 'answer';
	sdp.sdp = desc['sdp'];
	console.log('answer:remoteDescription:');
  console.log(sdp);
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

socket.on("serachFileResult", function (info) {
  fileFrom[info.id] = info.users;
  $("#fileSearchResult").empty();
  $("#fileSearchResult").append("<div><label>查询结果</label></div><label>文件id：<span>" + info.id + "&nbsp;&nbsp;&nbsp;&nbsp;</span>  " +
    "<label>文件名：</label><span>" + info.name + "&nbsp;&nbsp;&nbsp;&nbsp;</span></label>" +
    "<label>大小：</label><span>" + convertSize(info.size) + "</span></label>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; " +
    "<button type=\"button\" id=\"btn-downloadFile\" onclick=\"downloadFile('" + info.id + "','" + info.name + "'," + info.size + ")\" class=\"btn btn-success btn-xs\">下载</button>");
});

socket.on("searchFileError", function (error) {
  console.log(error);
  fileError("未找到此文件");
});


/**************************RTCPeerConnection********************************/



function start(isInitiator, friendsId, ischatChannel, fileId, blockId) {
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
            'description': pc.localDescription,
            'isChat': ischatChannel
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
      setupChat(friendsId, ischatChannel, fileId, blockId);
      if (ischatChannel)
        openSession(friendsId);
	} else {
		// setup chat on incoming data channel
		pc.ondatachannel = function (evt) {
			dataChannels[friendsId] = evt.channel;
      setupChat(friendsId, ischatChannel, 0);
		};
  }
}


function setupChat(id, ischatChannel, fileId, blockId) {
  if (ischatChannel) {
    dataChannels[id].onopen = function () {
      $("#myFriend-" + id).attr("disabled", false);
      addConnection(id);
      console.log('channel open');
      var me = $("#ipt-userId").val();
      var message = {
        'from': me,
        'tag': "rsaKey",
        'key': publicKey
      };
      dataChannels[id].send(JSON.stringify(message));
    };
  } else {//file channel
    if (fileId) {
      dataChannels[id].onopen = function () {
        console.log('channel open');
        var me = $("#ipt-userId").val();
        var message = {
          "from": me,
          "fileId": fileId
        };
        if (blockId == 'full') {
          message['tag'] = 'askFile';
          receiveFiles[fileId] = new Uint8Array();
        } else {
          message['tag'] = 'askBlock';
          message['blockId'] = blockId;
          receiveFiles[fileId][blockId] = {};
          receiveFiles[fileId][blockId]['data'] = new Uint8Array();
        }
        dataChannels[id].send(JSON.stringify(message));
      };
    } else {
      dataChannels[id].onopen = function () {
        console.log('channel open');
      };
    }
  }
  dataChannels[id].onmessage = function (evt) {
    var message = JSON.parse(evt.data);
    switch (message['tag']) {
      case 'chat':
        handleChat(id, message);
        break;
      case 'askFile':
        sendSingleFile(id, message.fileId);
        break;
      case 'fileToChat':
      {
        var connection = document.getElementById("friendsSession-" + id);
        if (!connection) {
          addConnection(id);
          friendsKeys[id] = message['key'];
        }
        break;
      }
      case 'completeFile':
      {
        receiveCompleteFile(message);
        break;
      }
      case 'askBlock':
      {
        sendBlock(id, message);
        break;
      }
      case 'fileBlock':
      {
        receiveBlock(message);
        break;
      }
      case 'rsaKey':
      {
        friendsKeys[id] = message['key'];
      }
      default:
        console.log("a message from " + id);
    }

  };
  dataChannels[id].onclose = function () {
    delete(dataChannels[id]);
    delete(peerConnections[id]);
    connections.splice(id, 1);
    console.log(id + ' disconnected !');
    removeConnection(id);
  }
}


function logError(error) {
  console.log(error.name + ': ' + error.message);
}


/****************************IndexedDB 操作部分****************************************/
var idbVersion = 0;
var idbSuccess = function (event) {
  console.log("MyDatabase created/open successfully !");
	var db = event.target.result;
	var transaction = db.transaction(["files"], "readwrite");
	var objectStore = transaction.objectStore("files");
	var request = objectStore.getAll();
	request.onsuccess = function (e) {
		var files = e.target.result;
		for (var i = 0; i < files.length; i++) {
			var file = files[i];
      var data = {
        'id': file['id'],
        'name': file['name'],
        'size': file['file'].size
      };
      socket.emit('addFile', data);
		}
    db.close();
	}
};
var idbError = function (event) {
  console.log("Fail to create/open MyDatabase: ", event.target.error.message);
};
/**
 * [初始化数据库]
 */
$(document).ready(function () {
  ME = $("#ipt-userId").val();
	if(!window.indexedDB) {
		console.log("Sorry! Your browser don't support IndexedDB");
    return false;
	}
  var req = indexedDB.open("MyDatabase");
  req.onerror = idbError;
  req.onsuccess = function (e) {
    var database = e.target.result;
    idbVersion = parseInt(database.version);
    database.close();
    var request = indexedDB.open("MyDatabase", ++idbVersion);
    request.onsuccess = idbSuccess;
    request.onerror = idbError;
    request.onupgradeneeded = function (event) {
      var db = event.target.result;
      if (!db.objectStoreNames.contains('files')) {
        db.createObjectStore('files', {
          keyPath: "id"
        });
      }
      var table = 'RecordOf' + ME;
      if (!db.objectStoreNames.contains(table)) {
        var store = db.createObjectStore(table, {
          autoIncrement: true
        });
        store.createIndex('friendIdIndex', 'friendId', {unique: false});
        console.log("create Chat Record of " + ME);
      }
    };
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
	if(!file){
		console.log("No file !");
		return false;
	}
  var fileName = file.name;
  var fileSize = file.size;
  var tempId = Date.parse(new Date());
  showUploadProcess(tempId, fileName, fileSize);
  getMd5(file, tempId).then(function (md_5) {
		var data = {
		'id': md_5,
      'name': fileName,
		'file': file
		};
		console.log(data);
    var req = indexedDB.open("MyDatabase");
		req.onerror = idbError;
		req.onsuccess = function (event) {
			db = event.target.result;
			var transaction = db.transaction(["files"], "readwrite");
			transaction.onerror = function (event) {
				console.log("Fail to add file",event.target.error);
        fileError('文件上传失败, ' + event.target.error);
        clearUploadBar(tempId);
      };
			transaction.oncomplete = function (event) {
        // console.log("complete !");
        showFileInfo();
        uploadComplete(tempId, fileName);
        fileSuccess('文件上传成功');
      };
			var objectStore = transaction.objectStore("files");
			var request = objectStore.add(data);
			request.onsuccess = function(event) {
		    	console.log("Add file successfully !");
                var fileInfo = {
                    'id': md_5,
                  'name': fileName,
                  'size': fileSize
                };
		    	socket.emit('addFile',fileInfo);
      };
      request.onerror = function (e) {
        fileError('文件上传失败, '+e.target.error);
        clearUploadBar(tempId);
      }
		}
  }, function (info) {
    fileError(info);
  });
}

function stopUpload(tempId) {
  uploadFlag[tempId] = true;
  clearUploadBar(tempId);
}

/**
 *获取本地保存的文件信息
 * @returns {*}
 */
function getFiles() {
	return new Promise(function (resolve,reject) {
    var request = window.indexedDB.open("MyDatabase");
		request.onerror = function(e) {
			console.log(e.currentTarget.error.message);
      reject("Error in getFiles !");
		};
		request.onsuccess = function(e) {
			var db = e.target.result;
			var transaction = db.transaction(["files"], "readonly");
			var store = transaction.objectStore("files");
      var files = [];
			var req = store.openCursor();
			req.onsuccess = function(event) {
        var cursor = event.target.result;
				if(cursor){
          files.push(cursor.value);
          cursor.continue();
        }
				else
          resolve(files);//promise
			};
		};
	});
}

function getFile(id) {
  return new Promise(function (resolve,reject){
    var request = window.indexedDB.open("MyDatabase");
    request.onerror = function(e) {
      console.log(e.currentTarget.error.message);
      reject("Error in getFile !");
    };
    request.onsuccess = function(e) {
      var db = e.target.result;
      var transaction = db.transaction(["files"], "readonly");
      var store = transaction.objectStore("files");
      var req = store.get(id);
      req.onsuccess = function (event) {
        var file = event.target.result;
        if (file) {
          resolve(file);//promise
        }
        else
          reject("No file found !");
      };
    }
  });
}


function fileDetail(id){
  getFile(id).then(function (file) {
    var info = file['file'];
    $("#file-name").text(file.name);
    $("#file-size").text(convertSize(info.size));
    $("#file-lastModify").text(dataFormat(info.lastModified));
    $("#file-type").text(info.type);
    $("#file-md5").text(file.id);
    $("#btn-deleteFile").attr("onclick","deleteFileById('"+file.id+"')");
    $("#file-info").modal('show');
  },function (error) {
    console.log(error);
  });
}



/**
 * [deleteFile 按id删除文件信息]
 * @param  {[type]} id [MD5值]
 */
function deleteFile(id) {
  var request = window.indexedDB.open("MyDatabase");
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
      showFileInfo();
      alertInfoSuccess("文件删除成功！");
			socket.emit('deleteFile',id);
		};
		req.onerror = function (e) {
      alertInfoDanger("文件删除失败，"+e.target.error);
			console.log("delete error !");
		}
	};				
}

/**
 * [deleteAll 删除所有文件信息]
 */
function deleteAll(){
  var request = window.indexedDB.open("MyDatabase");
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
		};
		req.onerror = function (e) {
			console.log("delete error !");
		}
	};				
}

function deleteRecordOfUser(userId) {
  var request = indexedDB.open("MyDatabase", ++idbVersion);
  request.onupgradeneeded = function (e) {
    var db = e.target.result;
    if (db.objectStoreNames.contains('RecordOf' + userId)) {
      db.deleteObjectStore('RecordOf' + userId);
      console.log("delete chat record of " + userId);
    }
  };
  request.onerror = idbError;
}
function addChatRecord(MyId, friendId, record) {
  var req = indexedDB.open("MyDatabase");
  req.onerror = idbError;
  req.onsuccess = function (event) {
    db = event.target.result;
    var table = "RecordOf" + MyId;
    var transaction = db.transaction([table], "readwrite");
    transaction.onerror = function (event) {
      console.log("储存聊天记录时发生错误：" + event.target.error.message);
    };
    var objectStore = transaction.objectStore(table);
    record.friendId = friendId;
    var request = objectStore.add(record);
    request.onerror = function (event) {
      console.log("储存聊天记录时发生错误：" + event.target.error.message);
    }
  }
}

function getChatRecords(MyId, friendId, start) {
  return new Promise(function (resolve, reject) {
    var request = window.indexedDB.open("MyDatabase");
    request.onerror = function (e) {
      console.log(e.target.error.message);
      reject("Error in showChatRecords !");
    };
    request.onsuccess = function (e) {
      try {
        var db = e.target.result,
          table = "RecordOf" + MyId,
          transaction = db.transaction([table], "readonly"),
          store = transaction.objectStore(table),
          index = store.index("friendIdIndex"),
          advancing = start * 10,
          records = [],
          count = 0,
          req = index.openCursor(friendId, "prev");
        req.onsuccess = function (event) {
          var cursor = event.target.result;
          if (advancing > 0) {
            cursor.advance(advancing);
            advancing = false;
          } else {
            if (cursor && count < 10) {
              records.push(cursor.value);
              count++;
              cursor.continue();
            } else {
              if (records.length)
                resolve(records);
              else
                reject(0);
            }
          }
        };
        transaction.onerror = function (event) {
          console.log("读取聊天记录时发生错误：" + event.target.error.message);
        };
      } catch (error) {
        console.log(error.name + " " + error.message + " " + error.code);
        reject("Error in showChatRecords !");
      }
    }
  });
}


/**************************************文件操作部分**********************************************/

/**
 * 获取文件的MD5值
 * @return {[type]}
 */
function getMd5(file, tempId) {
	return new Promise(function (resolve,reject) {
		// var file = document.getElementById("file").files[0];
    uploadFlag[tempId] = false;
		var blobSlice = File.prototype.slice || File.prototype.mozSlice || File.prototype.webkitSlice,
      sliceSize = 2097152, // read in chunks of 2MB
      chunks = Math.ceil(file.size / sliceSize),
		currentChunk = 0,
		spark = new SparkMD5.ArrayBuffer(),
		frOnload = function(e){
      if (uploadFlag[tempId])
        reject("用户终止了上传");
      // console.log("read "+Math.ceil(currentChunk/chunks*10000)/100+"% of this file ...");
			spark.append(e.target.result); // append array buffer
			currentChunk++;
      setBarValue(tempId, Math.round(currentChunk / chunks * 10000) / 100);
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
      var start = currentChunk * sliceSize,
        end = ((start + sliceSize) >= file.size) ? file.size : start + sliceSize;
			fileReader.readAsArrayBuffer(blobSlice.call(file, start, end));
    }
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

function showFileInfo() {
	getFiles().then(function (files) {
    $("#file-content").empty();
		for(var id in files){
      var file = files[id],
        info = file['file'];
      // console.log(file);
      $("#file-content").append("<button onclick=\"fileDetail(\'"+file.id+"\')\" class=\"content-btn btn btn-block\">" +
        "<div class=\"content-header\">"+file.name+"</div><div class=\"content-message\"><span class=\"message-left\">" +
        convertSize(info.size)+"</span><span class=\"message-right\">"+dataFormat(info.lastModified)+"</span></div></button>");

    }
	},function (error) {
		console.log(error);
	});
}


function sendSingleFile(userId, fileId) {
  getFile(fileId).then(function (file) {
    sendFileBlock(userId, file, 0, 1)
  }, function (error) {
    console.log(error);
  });
}

function sendBlock(userId, message) {
  var fileId = message['fileId'],
    blockId = message['blockId'];
  getFile(fileId).then(function (file) {
    sendFileBlock(userId, file, blockId, 0)
  }, function (error) {
    console.log(error);
  });
}


function sendFileBlock(userId, data, blockId, isCompleteFile) {
  var blobSlice = File.prototype.slice || File.prototype.mozSlice || File.prototype.webkitSlice;
  var file = data['file'],
    blockStart = blockId * blockSize,
    currentChunk = 0;
  var restSize = file.size - blockStart;
  var totalChunk = Math.ceil((restSize > blockSize ? blockSize : restSize) / chunkSize);
  readChunkOnLoad = function (e) {
    var message = {
      'chunk': e.target.result,
      'id': data['id']
    };
    if (isCompleteFile) {
      message['tag'] = 'completeFile';
    } else {
      var me = $("#ipt-userId").val();
      message['tag'] = 'fileBlock';
      message['blockId'] = blockId;
      message['from'] = me;
    }
    currentChunk++;
    if (currentChunk < totalChunk) {
      message['isLast'] = 0;
      dataChannels[userId].send(JSON.stringify(message));
      // console.log("send " + Math.ceil(currentChunk / totalChunk * 10000) / 100 + "% of this block ...");
      readNext();
    }
    else {
      message['isLast'] = 1;
      message['name'] = data['name'];
      dataChannels[userId].send(JSON.stringify(message));
      console.log("send block completely !");
    }
  };
  readChunkOnError = function (e) {
    console.log("error", e.target.result);
  };
  readNext = function () {
    var fileReader = new FileReader();
    fileReader.onload = readChunkOnLoad;
    fileReader.onerror = readChunkOnError;
    var start = currentChunk * chunkSize + blockStart,
      end = ((start + chunkSize) >= file.size) ? file.size : (start + chunkSize);
    fileReader.readAsDataURL(blobSlice.call(file, start, end));
  };
  readNext();
}

function receiveCompleteFile(message) {
  var fileId = message['id'];
  receiveFiles[fileId] = mergeArray(receiveFiles[fileId], dataURLtoBlob(message['chunk']));
  if (message['isLast']) {
    saveFile(fileId, message['name'], receiveFiles[fileId].byteLength);
  }
}

function receiveBlock(message) {
  var fileId = message['id'],
    blockId = message['blockId'],
    now = Date.parse(new Date()) / 1000;
  var messageData = dataURLtoBlob(message["chunk"]);
  delete message["chunk"];
  receiveFiles[fileId][blockId]['data'] = mergeArray(receiveFiles[fileId][blockId]['data'], messageData);
  messageData = null;
  mergingFiles[fileId]['currentSize'] += chunkSize;
  setBarValue(fileId, (mergingFiles[fileId]['currentSize'] * 100 / mergingFiles[fileId]['size']));
  var time = now - mergingFiles[fileId]['time'];
  if (time) {
    var sizeOfTime = mergingFiles[fileId]['currentSize'] - mergingFiles[fileId]['preSize'];
    showSpeed(fileId, convertSize(sizeOfTime / time));
    mergingFiles[fileId]['preSize'] = mergingFiles[fileId]['currentSize'];
    mergingFiles[fileId]['time'] = Date.parse(new Date()) / 1000;
  }
  if (message['isLast']) {
    receiveFiles[fileId][blockId]['status'] = "complete";
    if (blockId == 0) {
      mergingFiles[fileId]['data'] = receiveFiles[fileId][blockId]['data'];
      receiveFiles[fileId][blockId]['data'] = null;
      receiveFiles[fileId][blockId]['status'] = "merged";
      mergingFiles[fileId]['count']++;
      // console.log("接受块：0, 当前共接收到 " + mergingFiles[fileId]['count'] + "块,共" + convertSize(mergingFiles[fileId]['data'].byteLength));
    } else {
      var completeBlockCount = 0;
      for (var i = 0; i < blockId; i++) {
        if (receiveFiles[fileId][i]['status'] == "merged")
          completeBlockCount++;
      }
      console.log("completeBlockCount:" + completeBlockCount);
      if (completeBlockCount == blockId) {
        mergingFiles[fileId]['data'] = mergeArray(mergingFiles[fileId]['data'], receiveFiles[fileId][blockId]['data']);
        receiveFiles[fileId][blockId]['status'] = "merged";
        receiveFiles[fileId][blockId]['data'] = null;
        mergingFiles[fileId]['count']++;
        // console.log("接受块：" + blockId + " , 当前共接收到 " + mergingFiles[fileId]['count'] + "块,共" + convertSize(mergingFiles[fileId]['data'].byteLength));
      }
    }

    if (mergingFiles[fileId]['count'] == mergingFiles[fileId]['total']) {
      saveMergeFile(fileId, message['name'], mergingFiles[fileId]['data'].byteLength);
    } else {
      for (var i = 0; i < receiveFiles[fileId].length; i++) {
        if (typeof(receiveFiles[fileId][i]) == "undefined") {
          var me = $("#ipt-userId").val();
          var data = {
            'tag': 'askBlock',
            "from": me,
            "fileId": fileId,
            'blockId': i
          };
          receiveFiles[fileId][i] = {};
          receiveFiles[fileId][i]['data'] = new Uint8Array();
          receiveFiles[fileId][i]['status'] = 'receiving';
          dataChannels[message['from']].send(JSON.stringify(data));
          break;
        }
      }
    }
  }
}

function saveFile(id, fileName, fileSize) {
  downloadComplete(id, fileName, fileSize);
  saveAs(new Blob([new Uint8Array(receiveFiles[id])]), fileName);
  delete receiveFiles[id];
}


function saveMergeFile(id, fileName, fileSize) {
  downloadComplete(id, fileName, fileSize);
  saveAs(new Blob([mergingFiles[id]['data']]), fileName);
  delete receiveFiles[id];
  delete mergingFiles[id];
}

function dataURLtoBlob(dataURL) {
  var byteString;
  if (dataURL.split(',')[0].indexOf('base64') >= 0)
    byteString = atob(dataURL.split(',')[1]);
  else
    byteString = unescape(dataURL.split(',')[1]);
  var ia = new Uint8Array(byteString.length);
  for (var i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return ia;
}


/*********************************************************************************/
function dataFormat(stamp) {
  var date = new Date(stamp),
    y = date.getFullYear(),
    m = date.getMonth()+1,
    d = date.getDate(),
    h = date.getHours(),
    min = date.getMinutes();
  m = m < 10 ? ('0' + m) : m;
  d = d < 10 ? ('0' + d) : d;
  h = h < 10 ? ('0' + h) : h;
  min = min < 10 ? ('0' + min) : min;
  return y+'-'+m+'-'+d+' '+h+':'+min;
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
    var html = "<button id=\"myFriend-" + info['id'] + "\" class=\"content-btn btn btn-block\" onclick=\"talkWith(" + info['id'] + ",'" + info['nickname'] + "','" + info['portrait'] + "')\" ><div class=\"list-left\"><img id=\"img" + info['id'] + "\" src=" + (info["portrait"] || "http://i4.buimg.com/6b2fade4a2d1b576.jpg")
      +" class=\"img-rounded freinds-display\"/></div><div class=\"list-right\"><div id=\"nickname"+info['id']+"\" class=\"content-header\">"+info["nickname"]
      + "</div><div class=\"content-message\">" + (info["motto"] || "该用户无签名") + "</div></div></button>";
    $("#friends").append(html);
  }
});

function talkWith(id,name,pic) {
  if(dataChannels[id]){
    openSession(id,name,pic);
    var connection = document.getElementById("friendsSession-" + id);
    if (!connection) {
      addConnection(id);
      var me = $("#ipt-userId").val();
      var message = {
        'from': me,
        'tag': "fileToChat",
        'key': publicKey
      };
      dataChannels[id].send(JSON.stringify(message));
    }
  }else{
    $("#myFriend-" + id).attr("disabled", "disabled");
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
  $("#message-plain").empty();
  showChatRecords(id, 0);
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
    var htmlId = 'myMessage-' + Date.parse(new Date());
    var html = "<div id='" + htmlId + "' class=\"row\" style=\"opacity: 0;\"><div class=\"my-photo\"><img src=\"" + pic + "\" class=\"img-rounded freinds-display\"/></div><div class=\"my-tag\">" +
      content+"</div></div>";
    var encrypt = new JSEncrypt();
    var myEncrypt = new JSEncrypt();
    encrypt.setPublicKey(friendsKeys[id]);
    myEncrypt.setPublicKey(publicKey);
    var contentSlice = Math.ceil(content.length / 80);
    //发送给对方的加密信息（用对方公钥加密）
    var content_encrypt = {};
    //我自己储存的加密信息（用我自己的公钥加密）
    var myContent = {};
    for (var i = 0; i < contentSlice; i++) {
      var start = i * 80,
        end = (start + 80) > content.length ? content.length : start + 80;
      content_encrypt[i] = encrypt.encrypt(content.substring(start, end));
      myContent[i] = myEncrypt.encrypt(content.substring(start, end));
    }
    content_encrypt['slice'] = contentSlice;
    content_encrypt['tag'] = 'chat';
    // console.log(content_encrypt);
    dataChannels[id].send(JSON.stringify(content_encrypt));
    //储存聊天信息  content_encrypt
    //content_encrypt['owner'] 1:我发给对方的信息 0:对方发给我的信息
    myContent['owner'] = 1;
    myContent['slice'] = contentSlice;
    addChatRecord(ME, id, myContent);
    $("#friendMessage"+id).text("[我]："+content.substring(0,15));
    $("#message-plain").append(html);
    $("#message-content").val("");
    $("#" + htmlId).animate({opacity: 1}, 3000);
    jumpToBottom();
  }
}


function handleChat(id, content_encrypt) {
  // console.log(content_encrypt);
  var decrypt = new JSEncrypt();
  decrypt.setPrivateKey(privateKey);
  var encrypt = new JSEncrypt();
  encrypt.setPublicKey(publicKey);
  var slice = parseInt(content_encrypt['slice']);
  var content = "";
  var record = {};
  for (var i = 0; i < slice; i++) {
    // console.log(decrypt.decrypt(content_encrypt[i]));
    var chunk = decrypt.decrypt(content_encrypt[i]);
    content += chunk;
    record[i] = encrypt.encrypt(chunk);
  }
  $("#friendMessage"+id).text(content.substring(0,15));
  if($("#session").css("display")=="block"&&$("#session-id").val()==id){
    var pic = $("#friend-pic").val();
    var htmlId = "friendsMsg-" + Date.parse(new Date());
    var html = "<div id='" + htmlId + "' class=\"row\" style=\"opacity: 0;\"><div class=\"friends-photo\"><img src=\"" + pic + "\" class=\"img-rounded freinds-display\"/></div><div class=\"friends-tag\">" + content + "</div></div>";
    $("#message-plain").append(html);
    showReturnBottom();
    $("#" + htmlId).animate({opacity: 1}, 3000);
  }
  //储存聊天信息到Indexed DB
  record['owner'] = 0;
  record['slice'] = slice;
  addChatRecord(ME, id, record);

}

function convertSize(size) {
  if(size<1000){
    return size.toFixed(1) + "B";
  }else{
    size /= 1024;//to KB
    if(size<1000){
      return size.toFixed(1)+"KB";
    }else{
      size /= 1024;//to MB
      if(size<1000){
        return size.toFixed(1)+"MB";
      }else{
        size /= 1024;
        return size.toFixed(1)+"GB";
      }
    }
  }
}

function deleteFileById(id){
  deleteFile(id);
  $('#file-info').modal('hide')
}

function downloadFile(id, name, size) {
  var users = fileFrom[id];
  if (!users) {
    fileError("无此文件或无用户在线");
    return false;
  }
  createDownloadingProcessBar(id, name, size);
  // single connect when file size <= 10MB
  if (size <= blockSize) {
    if (!dataChannels[users[0]])
      start(1, users[0], 0, id, 'full');
    else {
      var me = $("#ipt-userId").val();
      var message = {
        "tag": 'askFile',
        "from": me,
        "fileId": id
      };
      receiveFiles[id] = new Uint8Array();
      dataChannels[users[0]].send(JSON.stringify(message));
    }
  } else {
    var blocks = Math.ceil(size / blockSize);
    mergingFiles[id] = {
      'total': blocks,
      'data': new Uint8Array(),
      'count': 0,
      'size': size,
      'preSize': 0,
      'currentSize': 0,
      'time': Date.parse(new Date()) / 1000
    };
    //用户人数大于4时选择4个用户请求下载文件，小于4时请求所有用户
    if (users.length < 4) {
      receiveFiles[id] = new Array(blocks);
      var min = blocks < users.length ? blocks : users.length;
      for (var i = 0; i < min; i++) {
        console.log('connect to ' + users[i]);
        if (!dataChannels[users[i]]) {
          start(1, users[i], 0, id, i);
        }
        else {
          var me = $("#ipt-userId").val();
          var message = {
            "from": me,
            "fileId": id,
            "tag": 'askBlock',
            "blockId": i
          };
          receiveFiles[id][i] = {};
          receiveFiles[id][i]['data'] = new Uint8Array();
          dataChannels[users[i]].send(JSON.stringify(message));
        }
      }
    } else {
      //TODO 大于4时进行选择
    }
  }
}

function mergeArray(buffer1, buffer2) {
  var tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
  tmp.set(new Uint8Array(buffer1), 0);
  tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
  return tmp.buffer;
}
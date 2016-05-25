var express = require('express');
var router = express.Router();
var userDao = require('../dao/userDao');
var redisDao = require("../dao/redisDao");

/* GET home page. */

router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.get('/signin', function(req, res, next) {
  res.render('signin', { title: 'SignIn' });
});

router.post('/signin',function(req, res, next) {
	// req.session.regenerate(function(){
 //        req.session.userId = 1;
 //    	console.log(req.session);
 //        req.session.save();  //保存一下修改后的Session
 //    }); 
 	// req.session.userId = req.body.username;
  //   res.redirect('/');
	// req.session.userId = req.body.username; 
	// // if(req.session.userId)
	// // 	res.redirect('/');
	userDao.signin(req, res, next);
});

router.get('/signup',function (req,res,next) {
	res.render('signup',{title: 'SignUp'});
});

router.post('/signup',function (req,res,next) {
	userDao.add(req, res, next);
});



router.get('/main', function(req, res, next) {
	// console.log(req.session);
	if(req.session.userId&&req.session.userName) {
    userDao.showMyInfo(req, res, next);
	}
	else
		res.redirect('/');

});

router.get('/signout', function(req, res, next) {
	req.session.destroy(function(err) {
		console.log(err);
	});

	res.redirect('/');
});

router.post('/edit',function (req,res,next) {
  userDao.editUserInfo(req,res,next);
});

router.post('/upload',function(req,res,next){
  var link = req.body.link.toString();
  console.log(link);
  redisDao.editPortrait(req.session.userId,link);
  var message  = {
    'code':200,
    'msg':'修改成功'
  };
  res.json(message);
});

router.post('/queryById',function (req,res,next) {
  userDao.searchInfo(req,res,next);
});


module.exports = router;

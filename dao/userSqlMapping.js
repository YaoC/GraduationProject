// dao/userSqlMapping.js
// CRUD SQL语句
var users = {
  insert:'INSERT INTO users(user_id, username, password,regTime) VALUES(0,?,?,?)',
  update:'update users set username=?, password=? where user_id=?',
  delete: 'delete from users where user_id=?',
  queryById: 'select * from users where user_id=?',
  isOnly: 'select user_id from users where username=?',
  queryAll: 'select * from users',
  signIn: 'select user_id,username,password,regTime from users where username=?'
};

module.exports = users;
/**
 * Created by cyao on 16-5-11.
 */
var userInfo = {
  insert:'INSERT INTO user_info(id,sex,birthday,phone,private_key,public_key) VALUES(?,?,?,?,?,?)  on duplicate key'+
  ' update sex=VALUES(sex),birthday=VALUES(birthday),phone=VALUES(phone)',
  queryById: 'select * from user_info where id=?'
};

module.exports = userInfo;
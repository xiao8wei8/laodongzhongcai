#!/bin/bash
# 数据量检查脚本
# 用于监控数据库集合数据量变化

PROD_HOST="152.136.175.14"
PROD_PORT="27017"
PROD_DB="laodong"
LOG_FILE="/root/laodongzhongcai/backups/data_check.log"

echo "========================================="
echo "数据量检查"
echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================="

# 连接数据库检查数据量
mongosh "mongodb://${PROD_HOST}:${PROD_PORT}/${PROD_DB}" --quiet --eval '
print("数据库: '${PROD_DB}'");
print("各集合数据量:");
db.getCollectionNames().forEach(function(c) {
    var count = db.getCollection(c).countDocuments();
    print("  " + c + ": " + count);
});
'

# 记录日志
echo "$(date '+%Y-%m-%d %H:%M:%S') - 数据量检查完成" >> ${LOG_FILE}
echo "========================================="

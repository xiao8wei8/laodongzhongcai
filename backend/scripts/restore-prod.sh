#!/bin/bash
# 数据导入脚本 - 将本地数据库导入到生产服务器
# 使用方法: ./restore-prod.sh

# 配置
PROD_HOST="152.136.175.14"
PROD_PORT="27017"
PROD_DB="laodong"
BACKUP_DIR="/tmp/laodongzhongcai_backup"

# 提示信息
echo "========================================="
echo "劳动仲裁调解系统 - 数据导入脚本"
echo "========================================="
echo "目标服务器: ${PROD_HOST}:${PROD_PORT}"
echo "目标数据库: ${PROD_DB}"
echo ""

# 检查备份目录
if [ ! -d "$BACKUP_DIR" ]; then
    echo "错误: 备份目录不存在: $BACKUP_DIR"
    echo "请先在本地执行数据导出命令:"
    echo "  mongodump --db laodong --out /tmp/laodongzhongcai_backup"
    exit 1
fi

# 检查是否有备份数据
if [ ! -d "$BACKUP_DIR/laodong" ]; then
    echo "错误: 备份数据目录不存在: $BACKUP_DIR/laodong"
    exit 1
fi

# 确认操作
echo "即将清空生产数据库并导入数据!"
echo "集合列表:"
ls -1 "$BACKUP_DIR/laodong" | sed 's/\.bson$//' | sed 's/^/  - /'
echo ""
read -p "确认继续? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "操作已取消"
    exit 0
fi

# 执行导入
echo ""
echo "开始导入数据..."

# 先删除旧数据，再导入新数据
mongosh "mongodb://${PROD_HOST}:${PROD_PORT}/${PROD_DB}" --eval "
    // 删除所有集合的数据
    db.getCollectionNames().forEach(function(collection) {
        if (collection.startsWith('system.')) return;
        print('删除集合: ' + collection);
        db.getCollection(collection).drop();
    });
    print('数据库已清空');
"

# 导入数据
mongorestore --host "${PROD_HOST}" --port "${PROD_PORT}" --db "${PROD_DB}" --drop "${BACKUP_DIR}/laodong"

echo ""
echo "========================================="
echo "数据导入完成!"
echo "========================================="

# 验证导入结果
echo ""
echo "验证导入结果:"
mongosh "mongodb://${PROD_HOST}:${PROD_PORT}/${PROD_DB}" --eval "
    db.getCollectionNames().forEach(function(c) {
        var count = db.getCollection(c).count();
        print(c + ': ' + count + ' documents');
    });
"
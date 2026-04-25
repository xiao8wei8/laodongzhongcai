#!/bin/bash
# MongoDB 自动备份脚本
# 用于定时备份劳动仲裁调解系统数据库

# 配置
PROD_HOST="152.136.175.14"
PROD_PORT="27017"
PROD_DB="laodong"
BACKUP_DIR="/root/laodongzhongcai/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${PROD_DB}_${DATE}"

# 创建备份目录
mkdir -p ${BACKUP_DIR}

# 执行备份
echo "========================================="
echo "MongoDB 数据库备份"
echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================="
echo "开始备份数据库: ${PROD_DB}"
echo "备份文件: ${BACKUP_FILE}"

# 使用mongodump备份数据库
mongodump --host ${PROD_HOST} --port ${PROD_PORT} --db ${PROD_DB} --archive=${BACKUP_FILE}.archive --gzip

if [ $? -eq 0 ]; then
    echo "备份成功!"
    # 获取文件大小
    FILE_SIZE=$(du -h ${BACKUP_FILE}.archive | cut -f1)
    echo "备份文件大小: ${FILE_SIZE}"

    # 验证备份
    echo "验证备份文件..."
    mongorestore --host ${PROD_HOST} --port ${PROD_PORT} --db test_verify --archive=${BACKUP_FILE}.archive --gzip --drop 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "备份验证成功!"
        # 删除验证数据库
        mongosh "mongodb://${PROD_HOST}:${PROD_PORT}/test_verify" --eval "db.dropDatabase()"
    else
        echo "警告: 备份验证失败，请手动检查!"
    fi

    # 清理30天前的备份
    echo "清理30天前的备份..."
    find ${BACKUP_DIR} -name "${PROD_DB}_*.archive" -mtime +30 -delete
    echo "清理完成"

    # 记录备份日志
    echo "$(date '+%Y-%m-%d %H:%M:%S') - 备份成功 - ${BACKUP_FILE}.archive (${FILE_SIZE})" >> ${BACKUP_DIR}/backup.log
else
    echo "备份失败!"
    # 记录失败日志
    echo "$(date '+%Y-%m-%d %H:%M:%S') - 备份失败" >> ${BACKUP_DIR}/backup.log

    # 发送告警邮件（如果配置了邮件服务）
    # 这里可以添加发送邮件的逻辑
fi

echo "========================================="
echo "备份任务完成"
echo "========================================="

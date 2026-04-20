import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;

  /**
   * 连接到Socket.io服务器
   */
  connect(): Socket {
    if (!this.socket) {
      this.socket = io('http://localhost:5002', {
        transports: ['websocket'],
        autoConnect: true,
      });

      this.socket.on('connect', () => {
        console.log('Socket.io连接成功');
      });

      this.socket.on('disconnect', () => {
        console.log('Socket.io连接断开');
      });

      this.socket.on('error', (error) => {
        console.error('Socket.io错误:', error);
      });
    }
    return this.socket;
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * 加入房间
   * @param room 房间名称
   */
  joinRoom(room: string): void {
    if (this.socket) {
      this.socket.emit('joinRoom', room);
    }
  }

  /**
   * 发送案件更新通知
   * @param caseId 案件ID
   */
  emitCaseUpdate(caseId: string): void {
    if (this.socket) {
      this.socket.emit('caseUpdate', caseId);
    }
  }

  /**
   * 发送广播消息
   * @param message 消息内容
   */
  emitBroadcast(message: any): void {
    if (this.socket) {
      this.socket.emit('broadcastMessage', message);
    }
  }

  /**
   * 监听案件更新
   * @param callback 回调函数
   */
  onCaseUpdate(callback: (caseId: string) => void): void {
    if (this.socket) {
      this.socket.on('caseUpdated', callback);
    }
  }

  /**
   * 监听广播消息
   * @param callback 回调函数
   */
  onBroadcast(callback: (message: any) => void): void {
    if (this.socket) {
      this.socket.on('newBroadcast', callback);
    }
  }

  /**
   * 移除事件监听器
   * @param event 事件名称
   * @param callback 回调函数
   */
  off(event: string, callback: Function): void {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }
}

// 导出单例
export default new SocketService();

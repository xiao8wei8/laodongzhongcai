import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;

  /**
   * 连接到Socket.io服务器
   */
  connect(): Socket {
    if (!this.socket) {
      // 根据环境判断Socket连接方式
      const isProduction = import.meta.env.PROD;
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

      let socketUrl: string;
      let socketOptions: any;

      if (isProduction) {
        // 生产环境：通过相对路径，使用nginx代理
        socketUrl = '';
        socketOptions = {
          path: '/socket.io',
          transports: ['websocket', 'polling'],
          autoConnect: true,
        };
      } else {
        // 开发环境：直接连接后端服务
        const apiUrl = new URL(baseUrl, window.location.origin);
        socketUrl = apiUrl.origin;
        socketOptions = {
          path: '/socket.io',
          transports: ['websocket', 'polling'],
          autoConnect: true,
        };
      }

      this.socket = io(socketUrl, socketOptions);

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
  off(event: string, callback: (...args: any[]) => void): void {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }
}

// 导出单例
export default new SocketService();

import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
enum PlayerStatus {
  unReady,
  ready,
}
interface Player {
  uid: string;
  username:string
  status: PlayerStatus;
  isLeave: boolean; //是否离开
  score: 0;
}
@WebSocketGateway(80, {
  namespace: 'poker',
})
export class MyWebsocketGateway {
  room = 'room1';
  players: Map<string, Player>= new Map(); //所有玩家
  isStart = false; //是否开始

  round = 1; //回合数
  @WebSocketServer() server: Server;
  /**
   * 连接
   * @param client
   */
  handleConnection(client: Socket) {
    const uid = client.handshake.auth['uid'];
    console.log(`与服务器链接已建立,uid:${uid}`);
  }

  /**
   * 断开连接
   * @param client
   */
  handleDisconnect(client: Socket) {
    const uid = client.handshake.auth['uid'];
    console.log(`与服务器链接已断开,uid:${uid}`);
  }
  // 加入房间
  @SubscribeMessage('joinRoom')
  handleJoinRoom(client: Socket, payload) {
    const uid = payload.uid;
    const { username } = client.handshake.auth;
    console.log(`${uid} 以加入：${payload.roomId}`);
    client.join(payload.roomId);
    //初始化player
    const player = this.players.get(uid);
    if (this.isStart && player) {
      //已经开始了并且是之前玩过的
      this.players.set(uid, { ...player, isLeave: false });
    } else {
      //中途加入或者一开始就加入
      this.players.set(uid, {
        uid,
        username:username,
        status: PlayerStatus.unReady,
        score: 0,
        isLeave: false,
      });
    }
    const newestPlayer = this.players.get(uid)

    this.server.to(this.room).emit("joinRoom",{
      player:newestPlayer,
      players:[...this.players.values()]
    })
  }
  @SubscribeMessage('prepare')
  handlePrepare(client: Socket) {
    const uid = client.handshake.auth['uid'];
    const player = this.players.get(uid);
    this.players.set(uid, { ...player, status: PlayerStatus.ready });
    const newestPlayer = this.players.get(uid)
    this.server.to(this.room).emit("prepare",{
      player:newestPlayer,
      players:[...this.players.values()]
    })
    this.isStart = this.isAllReady();
    if (this.isStart) {
      this.server.emit('roundStart');
    }
  }
  isAllReady() {
    let isReady = true;
    this.players.forEach((player) => {
      if (player.isLeave === false && player.status !== PlayerStatus.ready) {
        isReady = false;
      }
    });
    return isReady;
  }
  // 离开房间
  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(client: Socket, payload) {
    const uid = payload.uid;
    console.log(`${uid} 以离开：${payload.roomId}`);
    client.leave(payload.roomId);
    const player = this.players.get(uid);
    this.players.set(uid, { ...player, isLeave: true });
    const newestPlayer = this.players.get(uid)
    this.server.to(this.room).emit("leaveRoom",{
      player:newestPlayer,
      players:[...this.players.values()]
    })
  }
  // 接受网页发送的数据
  @SubscribeMessage('message')
  handleMessage(client: any, payload: any) {
    console.log(payload.message);
    // 发送网页的数据给flutter端
    // client.emit('toflutter', payload.message)
    this.server.emit('toflutter', payload.message);
  }
}

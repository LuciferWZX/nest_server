import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Card } from './poker/card';
import { of } from 'rxjs';
enum PlayerStatus {
  unReady,
  ready,
}
interface Player {
  uid: string;
  username: string;
  status: PlayerStatus;
  isLeave: boolean; //是否离开
  score: 0;
  cards: Card[] | [];
}
@WebSocketGateway(80, {
  namespace: 'poker',
})
export class MyWebsocketGateway {
  pokers: Card[];
  room = 'room1';
  players: Map<string, Player> = new Map(); //所有玩家
  isStart = false; //是否开始

  round = 1; //回合数

  constructor() {
    this.pokers = this.initCards();
  }
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
        username: username,
        status: PlayerStatus.unReady,
        score: 0,
        isLeave: false,
        cards: [],
      });
    }
    const newestPlayer = this.players.get(uid);

    this.server.to(this.room).emit('joinRoom', {
      player: newestPlayer,
      players: [...this.players.values()],
      round: this.round,
    });
  }
  @SubscribeMessage('prepare')
  handlePrepare(client: Socket) {
    const uid = client.handshake.auth['uid'];
    const player = this.players.get(uid);
    this.players.set(uid, { ...player, status: PlayerStatus.ready });
    const newestPlayer = this.players.get(uid);

    this.server.to(this.room).emit('prepare', {
      player: newestPlayer,
      players: [...this.players.values()],
    });
    this.isStart = this.isAllReady();
    if (this.isStart) {
      console.log('都准备好了');
      this.handleRoundStart();
    }
  }
  isAllReady() {
    if (this.players.size < 2) {
      return false;
    }
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
    const { username } = client.handshake.auth;
    console.log(`${uid} 以离开：${payload.roomId}`);
    client.leave(payload.roomId);
    console.log('删除', this.isStart, this.round);
    if (!this.isStart && this.round === 1) {
      //这时候删除
      this.players.delete(uid);
    }

    const player = this.players.get(uid);
    if (player) {
      this.players.set(uid, { ...player, isLeave: true });
    }

    const newestPlayer = this.players.get(uid);
    this.server.to(this.room).emit('leaveRoom', {
      player: newestPlayer ?? { username },
      players: [...this.players.values()],
    });
  }

  @SubscribeMessage('roundStart')
  handleRoundStart() {
    //发
    const cardsIndex: number[] = [];

    for (const arr of this.players) {
      const player = arr[1];
      const group = [];
      for (let j = 0; j < 3; j++) {
        let cardIndex = Math.floor(Math.random() * 51);
        while (cardsIndex.includes(cardIndex)) {
          cardIndex = Math.floor(Math.random() * 51);
        }
        cardsIndex.push(cardIndex);
        group.push(this.pokers[cardIndex]);
      }
      player.cards = group;
      this.players.set(player.uid, player);
      console.log(2222, group);
      this.server.to(this.room).emit('sendCards', {
        player: player,
        players: [...this.players.values()],
      });
    }
  }
  // 接受网页发送的数据
  @SubscribeMessage('message')
  handleMessage(client: any, payload: any) {
    console.log(payload.message);
    // 发送网页的数据给flutter端
    // client.emit('toflutter', payload.message)
    this.server.emit('toflutter', payload.message);
  }

  initCards(): Card[] {
    const cards = [];
    for (let i = 0; i < 13; i++) {
      for (let j = 0; j < 4; j++) {
        const card = new Card(j, i);
        cards.push(card);
      }
    }
    console.log(cards.length);
    return cards;
  }
}

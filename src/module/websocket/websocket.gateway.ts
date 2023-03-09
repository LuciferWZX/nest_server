import { WebSocketGateway } from '@nestjs/websockets';

@WebSocketGateway(80, {
  transports: ['websocket'],
})
export class WebsocketGateway {}

import { Module } from '@nestjs/common';
import { MyWebsocketGateway } from './websocket.gateway';

@Module({
  providers: [MyWebsocketGateway],
})
export class WebsocketModule {}

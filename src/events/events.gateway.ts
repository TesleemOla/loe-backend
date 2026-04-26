import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: 'http://localhost:3000',
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @MessageBody() room: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(room);
    console.log(`Client ${client.id} joined room: ${room}`);
  }

  broadcastNewTransaction(unitId: string, transaction: any) {
    // We emit a general event, and clients can filter by unitId if they are managers,
    // or see everything if they are super admins.
    // Realistically you'd want rooms per unitId. Let's do that.
    this.server.to(`unit_${unitId}`).emit('newTransaction', transaction);
    // Also emit to a global admin room
    this.server.to('admins').emit('newTransaction', transaction);
  }

  broadcastAnalyticsUpdate(unitId: string) {
    this.server.to(`unit_${unitId}`).emit('analyticsUpdate');
    this.server.to('admins').emit('analyticsUpdate');
  }

}


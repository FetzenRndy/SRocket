import { STATUS_CODES } from './StatusCode';
import { InternalRoute } from 'src/router/Router';

export default class Response<T = any> {
	protected statusCode: number;
	protected data?: T;
	protected payloadMessage: string;
	protected socket: SocketIOExt.Socket;
	protected route: InternalRoute;
	protected server: SocketIOExt.Server;

	constructor(socket: SocketIOExt.Socket, route: InternalRoute, server: SocketIOExt.Server) {
		this.socket = socket;
		this.server = server;

		this.payloadMessage = '';
		this.statusCode = 200;
		this.route = route;
	}

	// -- Fluent properties.

	public status(code: number) {
		this.statusCode = code;
		return this;
	}

	public getStatus() {
		return this.statusCode;
	}

	public withData(obj: T) {
		this.data = obj;
		return this;
	}

	public getData() {
		return this.data;
	}

	public message(comment: string) {
		this.payloadMessage = comment;
		return this;
	}

	public getMessage() {
		return this.payloadMessage;
	}

	public error(message: string) {
		if (this.getStatus() < 499) {
			this.status(STATUS_CODES.INTERNAL_SERVER_ERROR);
		}

		this.message(message);

		return this;
	}

	// -- Sender functions

	public relay() {
		this.socket.emit(this.getEventRoute(), this.formatPayload());
	}

	public toAllExceptSender() {
		this.socket.broadcast.emit(this.getEventRoute(), this.formatPayload());
	}

	public toAllInRoom_ExceptSender(roomName: string) {
		// TODO: Support emit to multiple rooms -> Builder ?
		this.socket.to(roomName).emit(this.getEventRoute(), this.formatPayload());
	}

	public toAllInRoom(roomName: string) {
		this.server.in(roomName).emit(this.getEventRoute(), this.formatPayload());
	}

	public toAllInNamespace(namespaceName: string = '/') {
		this.server.of(namespaceName).emit(this.getEventRoute(), this.formatPayload());
	}

	public toIndividualSocket(socketID: string) {
		this.socket.to(socketID).emit(this.getEventRoute(), this.formatPayload());
	}

	// -- Misc Getters.

	public getSocket() {
		// TODO: Check if this socket is updated when socket is updated somewhere else!
		return this.socket;
	}

	// -- Private Helpers

	protected getEventRoute() {
		return this.route.config.route;
	}

	protected formatPayload() {
		return {
			message: this.getMessage(),
			status: this.getStatus(),
			payload: this.getData(),
		};
	}
}
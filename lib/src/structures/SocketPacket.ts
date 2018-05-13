export class SocketPacket implements SocketIO.Packet {
	public type: number;
	public nsp: string;
	public id: number;
	public data: Array<any>;

	constructor() {
		this.data = new Array<any>();
	}

	public static fromSocketIOPacket(sioPacket: SocketIO.Packet) {
		const socketPacket = new SocketPacket();
		socketPacket.type = sioPacket.type;
		socketPacket.data = sioPacket.data;
		socketPacket.nsp = sioPacket.nsp;
		socketPacket.id = sioPacket.id;

		return socketPacket;
	}

	public getRoutePath() {
		return this.data[0];
	}

	public getUserData() {
		return this.data[1];
	}

	public getAck() {
		return this.data[2];
	}

	public setRoutePath(newPath: string) {
		this.data[0] = newPath;
		return this;
	}

	public setUserData(newData: any) {
		this.data[1] = newData;
		return this;
	}
}

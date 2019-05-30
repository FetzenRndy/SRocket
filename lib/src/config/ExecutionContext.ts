import { Newable } from "../structures/Newable";
import { Middleware } from "../middleware/Middleware";

export class RuntimeConfiguration {
	public separationConvention: string = ":";

	public beforeGlobalMiddleware: Newable<Middleware>[];
	public afterGlobalMiddleware: Newable<Middleware>[];

	constructor() {
		this.beforeGlobalMiddleware = [];
		this.afterGlobalMiddleware = [];
	}
}

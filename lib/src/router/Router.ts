import * as RouteDecorator from "../decorator/Route";

import { Validator, ValidationResult, RuleSchema } from "../validation/Validator";

import { RouteConfig } from "../router/RouteConfig";
import { AbsentPropertyError } from "../errors/AbsentPropertyError";
import { CallbackCollection } from "../utility/CallbackCollection";
import { populateObject } from "../utility/PopulateObject";
import { ConsoleLogger } from "../logging/ConsoleLogger";
import { InternalRoute } from "../router/InternalRoute";
import { getModelProps } from "../decorator/ModelProp";
import { TypedPair } from "../structures/Pair";
import { Response } from "../io/Response";
import { Metadata } from "../utility/Metadata";
import { Request } from "../io/Request";
import { Newable } from "../structures/Newable";
import { Logger } from "../logging/Logger";
import { Route } from "../router/Route";
import { Model } from "../model/Model";

export type NewableRoute = Newable<Route>;

export enum RouterCallbackType {
	BEFORE_EVENT = "beforeEvent",
	AFTER_EVENT = "afterEvent",
	VALIDATION_ERROR = "onValidationError"
}

export class Router {
	protected logger: Logger;
	protected routes: InternalRoute[];
	protected server: SocketIO.Server;
	protected callbacks: CallbackCollection;

	public constructor(server: SocketIO.Server) {
		this.routes = new Array<InternalRoute>();
		this.server = server;
		this.logger = new ConsoleLogger("Router");

		this.callbacks = new CallbackCollection();
		this.callbacks.registerCollections([RouterCallbackType.BEFORE_EVENT, RouterCallbackType.AFTER_EVENT, RouterCallbackType.VALIDATION_ERROR]);
	}

	public route(packet: SocketIO.Packet, socket: SocketIO.Socket) {
		const route = this.findRoute(packet);
		if (!route) {
			return this.logger.warning(`Could not find a route for ${packet.data[0]}`);
		}

		this.invokeRoute(route, socket, packet).then();
	}

	public registerBulk(...routes: Array<NewableRoute>) {
		for (const route of routes) {
			this.register(route);
		}
	}

	public register(route: NewableRoute, routeConfig?: RouteConfig) {
		const instance = new route();
		const internalRoute = new InternalRoute(routeConfig || this.getRouteConfig(route), instance);

		this.logger.info(`Registering Route: ${internalRoute.getRoutePath()}`);

		const nestedRoutes = new Array<TypedPair<RouteConfig, NewableRoute>>();
		const properties = Object.getOwnPropertyNames(instance);
		for (const property of properties) {
			const metadata = this.getNestedRouteConfig(instance, property);
			if (metadata) {
				const nestedRoute = instance[property];
				nestedRoutes.push(new TypedPair(metadata, nestedRoute));
			}
		}

		if (nestedRoutes.length > 0) {
			for (const nestedRoute of nestedRoutes) {
				nestedRoute.key.path = internalRoute.getRoutePath() + nestedRoute.key.path;
				this.register(nestedRoute.value, nestedRoute.key);
			}
		}

		this.routes.push(internalRoute);
	}

	public registerCallback(type: RouterCallbackType, callback: Function) {
		this.callbacks.addCallback(type, callback);
	}

	protected getRouteConfig(route: Route | NewableRoute): RouteConfig {
		return Metadata.getClassDecorator(RouteDecorator.routeMetadataKey, route);
	}

	protected getNestedRouteConfig(route: Route | NewableRoute, property: string): RouteConfig {
		return Metadata.getPropertyDecorator(RouteDecorator.nestedRouteMetadataKey, route, property);
	}

	protected findRoute(packet: SocketIO.Packet) {
		for (const route of this.routes) {
			if (route.getRoutePath() === packet.data[0]) {
				return route;
			}
		}

		return null;
	}

	protected triggerValidationError(route: InternalRoute, error: Error, socket: SocketIO.Socket, packet: SocketIO.Packet) {
		try {
			route.getInstance().onValidationError(error, new Request(null, socket, packet), new Response(socket, route, this.server));
		} catch (error) {
			this.triggerInternalError(route, error, socket, packet);
		}
	}

	protected triggerInternalError(route: InternalRoute, error: Error, socket: SocketIO.Socket, packet: SocketIO.Packet) {
		route.getInstance().onError(error, new Request(null, socket, packet), new Response(socket, route, this.server));
	}

	protected invokeRoute(route: InternalRoute, socket: SocketIO.Socket, packet: SocketIO.Packet): Promise<void> {
		return new Promise((resolve, reject) => {
			const instance = route.getInstance();
			const response = new Response(socket, route, this.server);

			const execute = async validationResult => {
				if (validationResult.didFail()) {
					this.triggerValidationError(route, validationResult.errors[0], socket, packet);
				} else {
					const request = new Request(validationResult.target, socket, packet);
					try {
						this.callbacks.executeFor(RouterCallbackType.BEFORE_EVENT);

						await instance.before(request, response);
						await instance.on(request, response);
						await instance.after(request, response);

						this.callbacks.executeFor(RouterCallbackType.AFTER_EVENT);
					} catch (error) {
						this.triggerInternalError(route, error, socket, packet);
					}
				}
			};

			if (!route.config.model && !route.config.data) {
				execute(new ValidationResult({}));
			}

			if (route.config.model) {
				Router.validateWithModel(route.config.model, packet).then(execute);
			}

			if (route.config.data) {
				Router.validateWithRules(route.config.data, packet).then(execute);
			}
		});
	}

	protected static async validateWithModel(model: Newable<Model>, packet: SocketIO.Packet): Promise<ValidationResult> {
		const actualArgs = packet.data[1];
		if (!actualArgs) {
			return new ValidationResult(null, [new AbsentPropertyError("Got no data from the socket! All Properties are missing!", "*")]);
		}

		const setDataResult = populateObject<Model>(model, actualArgs, getModelProps(model));
		if (setDataResult.value.length > 0) {
			return new ValidationResult(null, setDataResult.value);
		}

		const validationResult = await Validator.validateClass(setDataResult.key);

		if (validationResult.didFail()) {
			return new ValidationResult(null, validationResult.errors);
		} else {
			return new ValidationResult(validationResult.target);
		}
	}

	protected static async validateWithRules(schema: RuleSchema, packet: SocketIO.Packet): Promise<ValidationResult> {
		const actualArgs = packet.data[1];
		return Validator.validateSchema(schema, actualArgs);
	}
}

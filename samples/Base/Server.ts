/*
	NOTE: Before I get to writing proper tests use this tool: http://amritb.github.io/socketio-client-tool/
	Alternativly you could use the repl client located at ~/scripts/socket-client-REPL.js, just run it with node...
*/

process.env["DEBUG"] = "srocket:*";

import { SRocket } from "../../lib/src";
import { UserModule } from "./Users/Users.module";

SRocket.make(1340)
	.separationConvention(":")
	.modules(UserModule)
	.listen(app => {
		console.log(`Server is listening on ${app.config.port}`);
	});

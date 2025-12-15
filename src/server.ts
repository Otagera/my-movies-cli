import { Server } from "ssh2";
import fs from "fs";
import { runCli } from "./cli";

const sshServer = new Server(
	{
		hostKeys: [fs.readFileSync("host.key")],
	},
	(client) => {
		client
			.on("authentication", (ctx) => {
				// Insecure: accepts any password for any user.
				// TODO: Implement proper authentication.
				if (ctx.method === "password") {
					ctx.accept();
				} else {
					ctx.reject();
				}
			})
			.on("ready", () => {
				console.log("Client authenticated!");
				client.on("session", (accept, reject) => {
					const session = accept();
					session.once("pty", (accept, reject, info) => {
						(process.stdout as any).columns = info.cols;
						(process.stdout as any).rows = info.rows;
						session.on("window-change", (accept, reject, info) => {
							(process.stdout as any).columns = info.cols;
							(process.stdout as any).rows = info.rows;
							accept && accept();
						});
						accept();
					});
					session.on("shell", (accept, reject) => {
						const stream = accept();
						runCli({ input: stream, output: stream });
					});
				});
			})
			.on("close", () => {
				console.log("Client disconnected");
			});
	},
);

sshServer.listen(2222, "0.0.0.0", function () {
	console.log("SSH Server is listening on port 2222");
});

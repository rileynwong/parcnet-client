import {
  deepGet,
  postRPCMessage,
  RPCMessage,
  RPCMessageSchema,
  RPCMessageType,
  WindowMessageSchema,
  WindowMessageType
} from "@pcd/zupass-client";

import { useEffect, useContext } from "react";

import { ZappServer } from "./ZappServer";

export class ClientChannel {
  constructor(private port: MessagePort) {}

  public showZupass(): void {
    this.port.postMessage({
      type: RPCMessageType.ZUPASS_CLIENT_SHOW
    });
  }

  public hideZupass(): void {
    this.port.postMessage({
      type: RPCMessageType.ZUPASS_CLIENT_HIDE
    });
  }
}

function setupPort(port: MessagePort, server: ZappServer): void {
  port.addEventListener("message", async (event) => {
    console.log(`SERVER RECEIVED ${event.data.type}`);
    const message = RPCMessageSchema.parse(event.data);
    if (message.type === RPCMessageType.ZUPASS_CLIENT_INVOKE) {
      const path = message.fn.split(".");
      const functionName = path.pop();
      if (!functionName) {
        throw new Error("Path does not contain a function name");
      }
      const object = deepGet(server, path);
      const functionToInvoke = (object as Record<string, unknown>)[
        functionName
      ];
      try {
        if (functionToInvoke && typeof functionToInvoke === "function") {
          console.log("invoking function", functionToInvoke, message.args);
          try {
            const result = await functionToInvoke.apply(object, message.args);
            console.log(result);
            port.postMessage({
              type: RPCMessageType.ZUPASS_CLIENT_INVOKE_RESULT,
              result,
              serial: message.serial
            } satisfies RPCMessage);
          } catch (e) {
            console.log('Error here: ', message)
            port.postMessage({
              type: RPCMessageType.ZUPASS_CLIENT_INVOKE_ERROR,
              serial: message.serial,
              error: e + '', // TODO: error message?
            } satisfies RPCMessage);
          }
        } else {
          throw new Error("Function not found");
        }
      } catch (e) {
        port.postMessage({
          type: RPCMessageType.ZUPASS_CLIENT_INVOKE_ERROR,
          error: e + '', // TODO: error message
        });
      }
    }
  });
}

export function useZappServer(): void {
  console.log('Using Zapp Server...')
  const context = undefined;
  const zapp = undefined;

  useEffect(() => {
    window.addEventListener("message", async (event) => {
      let port: MessagePort;
      // @todo: handle repeat calls?
      console.log("Event: ", event);
      const data = WindowMessageSchema.safeParse(event.data);
      if (!data.success) {
        console.log('Data not a success...');
        return;
      }
      const msg = data.data;
      console.log("parcnet-client received message ", msg);

      const origin = event.origin;
      port = event.ports[0];
      port.start();

      const clientChannel = new ClientChannel(port);
      const server = new ZappServer(context, zapp, clientChannel);

      // @todo handle this with an action
      // context.update({ embeddedScreen: undefined });
      window.location.hash = "embedded";

      setupPort(port, server);
      port.postMessage({
        type: RPCMessageType.ZUPASS_CLIENT_READY
      });

    });
  });
}

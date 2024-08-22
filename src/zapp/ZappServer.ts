import { GPCPCDArgs } from "@pcd/gpc-pcd";
import { SerializedPCD } from "@pcd/pcd-types";
import { PODPCD } from "@pcd/pod-pcd";
import {
  ZupassAPI,
  ZupassFeeds,
  ZupassFileSystem,
  ZupassFolderContent,
  ZupassGPC,
  ZupassIdentity
} from "@pcd/zupass-client";
import { z } from "zod";
import { ClientChannel } from "./useZappServer";

function safeInput<This extends BaseZappServer, Args extends unknown[], Return>(
  parser: z.ZodSchema<Args>
) {
  return function actualDecorator(
    originalMethod: (this: This, ...args: Args) => Return,
    context: any
  ): (this: This, ...args: Args) => Return {
    function replacementMethod(this: This, ...args: Args): Return {
      const input = parser.safeParse(args);
      if (!input.success) {
        throw new Error(`Invalid arguments for ${context.name.toString()}`);
      }
      return originalMethod.call(this, ...input.data);
    }

    return replacementMethod;
  };
}

abstract class BaseZappServer {
  constructor(
    private context: any,
    private zapp: PODPCD,
    private clientChannel: ClientChannel
  ) {}

  public getZapp(): PODPCD {
    return this.zapp;
  }

  public getContext(): any {
    return this.context;
  }

  public getClientChannel(): ClientChannel {
    return this.clientChannel;
  }
}

class ParcnetGPC extends BaseZappServer implements ZupassGPC {
    public constructor(
        context: any,
        zapp: PODPCD,
        clientChannel: ClientChannel
    ) {
        super(context, zapp, clientChannel);
    }

    public prove(args: GPCPCDArgs) : Promise<SerializedPCD> {
        throw new Error("Not implemented");
    }
}

class ParcnetFeeds extends BaseZappServer implements ZupassFeeds {
    public constructor(
        context: any,
        zapp: PODPCD,
        clientChannel: ClientChannel
    ) {
        super(context, zapp, clientChannel);
    }

    public requestAddSubscription(feedUrl: string, feedId: string) : Promise<void> {
        throw new Error("Not implemented");
    }
}

class ParcnetIdentity extends BaseZappServer implements ZupassIdentity {
    public constructor(
        context: any,
        zapp: PODPCD,
        clientChannel: ClientChannel
    ) {
        super(context, zapp, clientChannel);
    }

  public async getIdentityCommitment(): Promise<bigint> {
    // TODO: replace with real code lol
    return BigInt(100);
  }

  public getAttestedEmails() : Promise<SerializedPCD[]> {
    throw new Error("Not implemented");
    }
}

class FileSystem extends BaseZappServer implements ZupassFileSystem {
  public constructor(
    context: any,
    zapp: PODPCD,
    clientChannel: ClientChannel
  ) {
    super(context, zapp, clientChannel);
  }

    public async list(path: string): Promise<ZupassFolderContent[]> {
      // TODO: Load POD data from external client
      return [];
    }

  public async get(path: string): Promise<SerializedPCD> {
    const pathElements = path.split("/");
    // @todo validate path, check permissions
    const pcdId = pathElements.pop();
    if (!pcdId) {
      throw new Error("No PCD ID found in path");
    }
    const pcdCollection = this.getContext().getState().pcds;
    const pcd = pcdCollection.getById(pcdId);
    if (!pcd) {
      throw new Error(`PCD with ID ${pcdId} does not exist`);
    }
    const serializedPCD = pcdCollection.serialize(pcd);

    return serializedPCD;
  }

  public async put(path: string, content: SerializedPCD): Promise<void> {
    // @todo validate path
    console.log("adding ", path, content);
    await this.getContext().dispatch({
      type: "add-pcds",
      folder: path,
      pcds: [content],
      upsert: true
    });
  }

  public async delete(_path: string): Promise<void> {
    throw new Error("Not implemented");
  }
}

export class ZappServer extends BaseZappServer implements ZupassAPI {
  public fs: ZupassFileSystem;
  public gpc: ZupassGPC;
  public feeds: ZupassFeeds;
  public identity: ZupassIdentity;
  public _version = "1" as const;

  constructor(
    context: any,
    zapp: any, // TODO: update to PODPCD?
    clientChannel: ClientChannel
  ) {
    super(context, zapp, clientChannel);
    this.fs = new FileSystem(context, zapp, clientChannel);
    this.gpc = new ParcnetGPC(context, zapp, clientChannel);
    this.feeds = new ParcnetFeeds(context, zapp, clientChannel);
    this.identity = new ParcnetIdentity(context, zapp, clientChannel);
  }
}

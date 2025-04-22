import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { Sessions } from "./session-storage.js";

// type MCPSSEPluginOptions = {
//   server: Server;
//   sessions?: Sessions;
//   sseEndpoint?: string;
//   messagesEndpoint?: string;
//   allowLocalOnly?: boolean;
// };


// FastifyPluginCallback<MCPSSEPluginOptions>
export const fastifyMCPSSE = (
  fastify,
  options,
  done,
) => {
  const {
    server,
    sessions = new Sessions(),
    sseEndpoint = "/sse",
    messagesEndpoint = "/messages",
    allowLocalOnly = true,
  } = options;


  // sessions.on("connected", (sessionId) => {
  //   console.log(`Session ${sessionId} connected`);
  // });
  
  // sessions.on("terminated", (sessionId) => {
  //   console.log(`Session ${sessionId} terminated`);
  // });

  // Helper function to check if request is from localhost
  function isLocalhost(req) {
    const ip = req.ip || req.socket.remoteAddress;
    return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  }

  fastify.get(sseEndpoint, async (req, reply) => {
    // Validate request comes from localhost if restriction is enabled
    if (allowLocalOnly && !isLocalhost(req)) {
      fastify.log.warn("Rejected non-localhost connection attempt", { ip: req.ip });
      reply.status(403).send({ error: "Access denied" });
      return;
    }

    const transport = new SSEServerTransport(messagesEndpoint, reply.raw);
    const sessionId = transport.sessionId;

    sessions.add(sessionId, transport);

    reply.raw.on("close", () => {
      sessions.remove(sessionId);
    });

    fastify.log.info("Starting new session", { sessionId });
    await server.connect(transport);
  });

  fastify.post(messagesEndpoint, async (req, reply) => {
    // Validate request comes from localhost if restriction is enabled
    if (allowLocalOnly && !isLocalhost(req)) {
      fastify.log.warn("Rejected non-localhost connection attempt", { ip: req.ip });
      reply.status(403).send({ error: "Access denied" });
      return;
    }
    
    const sessionId = extractSessionId(req);
    if (!sessionId) {
      reply.status(400).send({ error: "Invalid session" });
      return;
    }

    const transport = sessions.get(sessionId);
    if (!transport) {
      reply.status(400).send({ error: "Invalid session" });
      return;
    }

    await transport.handlePostMessage(req.raw, reply.raw, req.body);
  });

  return done();
};

// req: FastifyRequest
function extractSessionId(req) {
  if (typeof req.query !== "object" || req.query === null) {
    return undefined;
  }

  if ("sessionId" in req.query === false) {
    return undefined;
  }

  const sessionId = req.query["sessionId"];
  if (typeof sessionId !== "string") {
    return undefined;
  }

  return sessionId;
}
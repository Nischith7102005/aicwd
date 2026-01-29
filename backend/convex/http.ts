 import { httpRouter } from "convex/server";
import { api } from "./_generated/api";
import { httpAction } from "./_generated/server";

const http = httpRouter();

http.route({
  path: "/api/metrics/ingest",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    await ctx.runMutation(api.api.ingest, body);
    return new Response(null, { status: 200 });
  }),
});

http.route({
  path: "/api/red-team/start",
  method: "POST",
  handler: httpAction(async (ctx) => {
    await ctx.runAction(api.api.startRedTeam, {});
    return new Response(null, { status: 200 });
  }),
});

http.route({
  path: "/api/metrics/stream",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // In a real implementation, we would use a cleaner way to stream
    // This is a simplified SSE implementation
    const sendEvent = async (data: any) => {
      await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    };

    const interval = setInterval(async () => {
      const metrics = await ctx.runQuery(api.api.getLatestMetrics);
      // Generate some mock metrics if none exist to make it look alive
      const data = metrics.length > 0 ? metrics[0] : {
        token_efficiency: Math.random() * 0.8 + 0.2,
        semantic_drift: Math.random() * 0.3,
        waste_index: Math.random() * 3,
        adversarial_stress: Math.random() * 1.5,
        created_at: Date.now(),
      };
      await sendEvent(data);
    }, 5000);

    request.signal.addEventListener("abort", () => {
      clearInterval(interval);
      writer.close();
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }),
});

export default http;

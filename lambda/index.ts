import { Hono } from "hono";
import { handle } from "hono/aws-lambda";
import { v2 as cloudinary } from "cloudinary";

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { imagesTable } from "../lib/db/schema";
import { v4 } from "uuid";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";

const app = new Hono();
app.use(logger());

interface SignedUrlResponse {
  url: string;
  signature: string;
  timestamp: number;
  api_key: string;
  folder: string;
}

interface CloudinaryWebhookData {
  url: string;
  folder: string;
}
app.use("*", cors());
app.use("*", requestId());

app.get("/", (c) => c.text("Hello Hono!"));

app.post("/wh/save-in-db/:whsecret", async (c) => {
  const whsecret = c.req.param().whsecret;
  if (!whsecret || process.env.WH_SECRET !== whsecret) {
    return c.json({ error: "Invlid secret" }, 400);
  }
  const data = await c.req.json<CloudinaryWebhookData>();

  if (!data.url || data.folder === "" || !data.folder.includes("/")) {
    return c.json({ error: "Invalid data" }, 400);
  }

  const userId = data.folder.split("/")[1];

  if (!userId) {
    return c.json({ error: "Invalid data" }, 400);
  }

  try {
    const sql = neon(process.env.DATABASE_URL!);
    const db = drizzle(sql);
    await db
      .insert(imagesTable)
      .values({
        id: v4(),
        metadata: JSON.stringify(data),
        userId,
        url: data.url,
        timestamp: Math.round(new Date().getTime() / 1000),
      })
      .execute();

    return c.json({ message: "Image saved" }, 200);
  } catch (error) {
    console.log(error);
    return c.json({ error: "Internal server error!" }, 500);
  }
});

app.get("/generate-signed-url/:userId", async (c) => {
  const userId = c.req.param().userId;
  if (!userId) {
    return c.json({ error: "userId is required" }, 400);
  }
  const timestamp = Math.round(new Date().getTime() / 1000) - 59 * 60;
  const signature = cloudinary.utils.api_sign_request(
    {
      timestamp: timestamp,
      folder: `user_uploads/${userId}`,
    },
    process.env.API_SECRET!,
  );

  const response: SignedUrlResponse = {
    url: `https://api.cloudinary.com/v1_1/${process.env.CLOUD_NAME}/image/upload`,
    signature,
    timestamp,
    api_key: process.env.API_KEY!,
    folder: `user_uploads/${userId}`,
  };
  return c.json(response);
});

export const handler = handle(app);

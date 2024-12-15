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
import { jwt } from "hono/jwt";
import { sign } from "hono/jwt";

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

interface SignInBody {
  username: string;
  password: string;
}

const JWT_SECRET = process.env.JWT_SECRET || "default-secret-change-me";

app.use("*", cors());
app.use("*", requestId());

const jwtMiddleware = jwt({
  secret: JWT_SECRET,
});

app.get("/", (c) => c.text("Hello Hono!"));

app.post("/sign-in", async (c) => {
  try {
    const { username, password } = await c.req.json<SignInBody>();

    // TODO: actual user authentication logic here
    if (username === "demo" && password === "password") {
      const token = await sign({ username }, JWT_SECRET);
      return c.json({ token });
    } else {
      return c.json({ error: "Invalid credentials" }, 401);
    }
  } catch (error) {
    console.error("Error in /sign-in:", error);
    return c.json(
      { error: "Internal server error", details: (error as Error).message },
      500,
    );
  }
});

app.post("/sign-out", (c) => {
  return c.json({
    message:
      "Successfully signed out. Please remove the token from the client.",
  });
});

app.get("/protected", jwtMiddleware, (c) => {
  const payload = c.get("jwtPayload");
  return c.json({ message: "This is a protected route", user: payload });
});

app.post("/wh/save-in-db/:whsecret", async (c) => {
  try {
    const whsecret = c.req.param().whsecret;
    if (!whsecret || process.env.WH_SECRET !== whsecret) {
      return c.json({ error: "Invalid webhook secret" }, 401);
    }

    const data = await c.req.json<CloudinaryWebhookData>();

    if (!data.url || data.folder === "" || !data.folder.includes("/")) {
      return c.json(
        { error: "Invalid data format: missing url or folder" },
        400,
      );
    }

    const userId = data.folder.split("/")[1];

    if (!userId) {
      return c.json(
        { error: "Invalid data: unable to extract userId from folder" },
        400,
      );
    }

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

    return c.json({ message: "Image saved successfully" }, 200);
  } catch (error) {
    console.error("Error in /wh/save-in-db:", error);
    return c.json(
      { error: "Internal server error", details: (error as Error).message },
      500,
    );
  }
});

app.get("/generate-signed-url/:userId", jwtMiddleware, async (c) => {
  try {
    const userId = c.req.param().userId;
    if (!userId) {
      return c.json({ error: "userId is required" }, 400);
    }

    const timestamp = Math.round(new Date().getTime() / 1000) - 59 * 60;

    if (!process.env.API_SECRET) {
      throw new Error("API_SECRET is not set in environment variables");
    }

    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp: timestamp,
        folder: `user_uploads/${userId}`,
      },
      process.env.API_SECRET,
    );

    if (!process.env.CLOUD_NAME || !process.env.API_KEY) {
      throw new Error(
        "CLOUD_NAME or API_KEY is not set in environment variables",
      );
    }

    const response: SignedUrlResponse = {
      url: `https://api.cloudinary.com/v1_1/${process.env.CLOUD_NAME}/image/upload`,
      signature,
      timestamp,
      api_key: process.env.API_KEY,
      folder: `user_uploads/${userId}`,
    };

    return c.json(response);
  } catch (error) {
    console.error("Error in /generate-signed-url:", error);
    return c.json(
      { error: "Internal server error", details: (error as Error).message },
      500,
    );
  }
});

export const handler = handle(app);

import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function resolveScriptDir(): string | null {
  const scriptPath = path.join(process.cwd(), "scripts");
  if (fs.existsSync(path.join(scriptPath, "run_predict_pipeline.py"))) {
    return scriptPath;
  }
  return null;
}

type Body = {
  video?: Record<string, unknown>;
  channel?: Record<string, unknown> | null;
};

export async function POST(req: Request) {
  const scriptDir = resolveScriptDir();
  if (!scriptDir) {
    return NextResponse.json(
      {
        error:
          "Could not find scripts directory with run_predict_pipeline.py. Ensure the project is properly set up.",
      },
      { status: 500 }
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.video || typeof body.video !== "object") {
    return NextResponse.json({ error: "Missing video object" }, { status: 400 });
  }

  if (!body.channel) {
    return NextResponse.json(
      { error: "Prediction unavailable: Channel data required. Try another video or check the YouTube API key." },
      { status: 400 }
    );
  }

  const payload = {
    video: body.video,
    channel: body.channel,
  };

  const py = process.env.PYTHON_PATH || "python";
  const script = path.join(scriptDir, "run_predict_pipeline.py");
  console.log("[trending-predict] Running script:", script);
  console.log("[trending-predict] With payload:", JSON.stringify(payload).slice(0, 200));

  const { stdout, stderr, code } = await new Promise<{ stdout: string; stderr: string; code: number }>((resolve) => {
    const child = spawn(py, [script], {
      cwd: scriptDir,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, PYTHONUTF8: "1", PYTHONUNBUFFERED: "1" },
    });
    let out = "";
    let err = "";
    child.stdout?.on("data", (c: Buffer) => {
      out += c.toString("utf8");
    });
    child.stderr?.on("data", (c: Buffer) => {
      err += c.toString("utf8");
    });
    child.on("close", (exitCode) => {
      resolve({ stdout: out, stderr: err, code: exitCode || 0 });
    });
    child.on("error", (e) => {
      resolve({ stdout: "", stderr: e.message, code: 1 });
    });
    child.stdin?.write(JSON.stringify(payload), "utf8");
    child.stdin?.end();
  });

  if (code !== 0) {
    console.error("[trending-predict] Exit code:", code);
    console.error("[trending-predict] Stderr:", stderr);
    console.error("[trending-predict] Stdout:", stdout);
    return NextResponse.json(
      { error: "Prediction failed", detail: (stderr || stdout).slice(0, 500) },
      { status: 502 }
    );
  }

  if (!stdout.trim()) {
    console.error("[trending-predict] No output from Python script");
    return NextResponse.json(
      { error: "Prediction unavailable: No output from model" },
      { status: 502 }
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout.trim());
  } catch {
    console.error("[trending-predict] JSON parse error:", stdout.slice(0, 200));
    return NextResponse.json(
      { error: "Invalid JSON from predictor", detail: stdout.slice(0, 500) },
      { status: 502 }
    );
  }

  if (parsed && typeof parsed === "object" && "error" in parsed) {
    return NextResponse.json(parsed, { status: 502 });
  }

  return NextResponse.json(parsed);
}

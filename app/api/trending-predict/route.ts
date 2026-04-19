import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function resolveRepoRoot(): string | null {
  const env = process.env.DATA_HACK_ROOT;
  if (env && fs.existsSync(path.join(env, "run_predict_pipeline.py"))) {
    return env;
  }
  const fromCwd = path.join(process.cwd(), "run_predict_pipeline.py");
  if (fs.existsSync(fromCwd)) {
    return process.cwd();
  }
  const parent = path.join(process.cwd(), "..");
  if (fs.existsSync(path.join(parent, "run_predict_pipeline.py"))) {
    return path.resolve(parent);
  }
  return null;
}

type Body = {
  video?: Record<string, unknown>;
  channel?: Record<string, unknown> | null;
};

export async function POST(req: Request) {
  const repoRoot = resolveRepoRoot();
  if (!repoRoot) {
    return NextResponse.json(
      {
        error:
          "Could not find Data_hack repo (run_predict_pipeline.py). Set DATA_HACK_ROOT or run Next from YTBTrendingDashboard.",
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

  const payload = {
    video: body.video,
    channel: body.channel ?? undefined,
  };

  const py = process.env.PYTHON_PATH || "python";
  const script = path.join(repoRoot, "run_predict_pipeline.py");

  const stdout = await new Promise<string>((resolve, reject) => {
    const child = spawn(py, [script], {
      cwd: repoRoot,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, PYTHONUTF8: "1" },
    });
    let out = "";
    let err = "";
    child.stdout?.on("data", (c: Buffer) => {
      out += c.toString("utf8");
    });
    child.stderr?.on("data", (c: Buffer) => {
      err += c.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(err || `Python exited with code ${code}`));
        return;
      }
      resolve(out);
    });
    child.stdin?.write(JSON.stringify(payload), "utf8");
    child.stdin?.end();
  }).catch((e: Error) => {
    throw e;
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout.trim());
  } catch {
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

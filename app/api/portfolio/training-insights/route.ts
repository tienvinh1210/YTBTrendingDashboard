import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GlobalCategory = {
  categoryId: number;
  categoryName: string;
  count: number;
  share: number;
};

type CrossCategory = {
  categoryId: number;
  categoryName: string;
  countriesWithTop3Presence: number;
};

type CountryBlock = {
  country: string;
  trendingVideos: number;
  topCategories: GlobalCategory[];
};

type SimilarPair = {
  similarity: number;
  channelA: string;
  channelB: string;
  channelIdA: string;
  channelIdB: string;
  countryA: string | null;
  countryB: string | null;
  videosA: number;
  videosB: number;
};

type SimilarByCategory = {
  categoryId: number;
  categoryName: string;
  pairs: SimilarPair[];
};

export type PortfolioTrainingInsights = {
  sourceCsv: string;
  sourceCache: string;
  trendyRowCount: number;
  channelsWithCountry: number;
  summary: string;
  globalCategoryMix: GlobalCategory[];
  categoryTrendingAcrossCountries: CrossCategory[];
  topCategoriesByCountry: CountryBlock[];
  similarChannelsByCategory: SimilarByCategory[];
};

function resolveInsightsPath(): string | null {
  const env = process.env.DATA_HACK_ROOT;
  const candidates = [
    path.join(process.cwd(), "ml", "data", "portfolio_training_insights.json"),
    path.join(process.cwd(), "YTBTrendingDashboard", "ml", "data", "portfolio_training_insights.json"),
  ];
  if (env) {
    candidates.unshift(
      path.join(env, "YTBTrendingDashboard", "ml", "data", "portfolio_training_insights.json")
    );
  }
  const parent = path.resolve(process.cwd(), "..");
  candidates.push(
    path.join(parent, "YTBTrendingDashboard", "ml", "data", "portfolio_training_insights.json")
  );
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export async function GET() {
  const filePath = resolveInsightsPath();
  if (!filePath) {
    return NextResponse.json(
      {
        error:
          "portfolio_training_insights.json not found. Run: python YTBTrendingDashboard/scripts/compute_portfolio_training_insights.py",
      },
      { status: 404 }
    );
  }
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as PortfolioTrainingInsights;
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to read insights.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RecommendedChannel = {
  channelId: string;
  title: string;
  description: string;
  url: string;
  thumbnailUrl: string;
  subscriberCount: number;
  videoCount: number;
  country: string | null;
  topicCategories: string[];
  matchScore: number;
};

function calculateTopicMatch(
  topicCategories: string[],
  categoryName: string
): number {
  if (!topicCategories || topicCategories.length === 0) return 0;

  const categoryLower = categoryName.toLowerCase();
  const keywords = categoryLower.split(/\s+|[&\/]/);

  let matchCount = 0;
  for (const topic of topicCategories) {
    const topicLower = topic.toLowerCase();
    for (const keyword of keywords) {
      if (keyword && topicLower.includes(keyword)) {
        matchCount++;
        break;
      }
    }
  }

  return matchCount / Math.max(topicCategories.length, keywords.length);
}

async function fetchChannelsByCategory(
  apiKey: string,
  regionCode: string,
  categoryId: string,
  categoryName: string,
  maxResults: number
): Promise<{ items: RecommendedChannel[]; rawError?: string; status: number }> {
  const searchParamsApi = new URLSearchParams({
    part: "snippet",
    type: "video",
    videoCategoryId: categoryId,
    regionCode,
    order: "viewCount",
    maxResults: String(Math.min(maxResults * 3, 50)),
    key: apiKey,
  });

  const searchRes = await fetch(
    `https://www.googleapis.com/youtube/v3/search?${searchParamsApi.toString()}`,
    { cache: "no-store" }
  );

  if (!searchRes.ok) {
    const text = await searchRes.text();
    return { items: [], rawError: text, status: searchRes.status };
  }

  const searchData = await searchRes.json();
  const seenChannels = new Set<string>();
  const channelIds: string[] = (searchData.items ?? [])
    .map((it: { snippet?: { channelId?: string } }) => it.snippet?.channelId)
    .filter(
      (id: string | undefined): id is string =>
        typeof id === "string" && !seenChannels.has(id) && !seenChannels.add(id)
    )
    .slice(0, maxResults);

  if (channelIds.length === 0) {
    return { items: [], status: 200 };
  }

  const channelsParamsApi = new URLSearchParams({
    part: "snippet,statistics,topicDetails",
    id: channelIds.join(","),
    key: apiKey,
  });

  const channelsRes = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?${channelsParamsApi.toString()}`,
    { cache: "no-store" }
  );

  if (!channelsRes.ok) {
    const text = await channelsRes.text();
    return { items: [], rawError: text, status: channelsRes.status };
  }

  const channelsData = await channelsRes.json();

  type Thumb = { url: string; width?: number; height?: number };
  const items: RecommendedChannel[] = (channelsData.items ?? [])
    .filter(
      (ch: {
        snippet?: { country?: string | null };
      }) => ch.snippet?.country === regionCode
    )
    .map(
      (channel: {
        id: string;
        snippet: {
          title: string;
          description: string;
          thumbnails?: Record<string, Thumb | undefined>;
          country?: string | null;
        };
        statistics?: {
          subscriberCount?: string;
          videoCount?: string;
        };
        topicDetails?: {
          topicCategories?: string[];
        };
      }) => {
        const t = channel.snippet?.thumbnails;
        const thumbnailUrl =
          t?.medium?.url ??
          t?.high?.url ??
          t?.default?.url ??
          t?.standard?.url ??
          "";

        const topicCategories = channel.topicDetails?.topicCategories ?? [];
        const matchScore = calculateTopicMatch(topicCategories, categoryName);

        return {
          channelId: channel.id,
          title: channel.snippet.title,
          description: channel.snippet.description,
          url: `https://www.youtube.com/@${channel.id}`,
          thumbnailUrl,
          subscriberCount: Number(channel.statistics?.subscriberCount ?? 0),
          videoCount: Number(channel.statistics?.videoCount ?? 0),
          country: channel.snippet.country ?? null,
          topicCategories,
          matchScore,
        };
      }
    )
    .sort((a: RecommendedChannel, b: RecommendedChannel) => b.matchScore - a.matchScore);

  return { items, status: 200 };
}

export async function GET(req: Request) {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing API_KEY in environment" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const categoryId = searchParams.get("categoryId");
  const regionCode = searchParams.get("regionCode");
  const categoryName = searchParams.get("categoryName") ?? "";
  const max = Math.min(Math.max(Number(searchParams.get("max") ?? "5"), 1), 25);

  if (!categoryId || !regionCode) {
    return NextResponse.json(
      { error: "categoryId and regionCode are required" },
      { status: 400 }
    );
  }

  const result = await fetchChannelsByCategory(apiKey, regionCode, categoryId, categoryName, max);

  if (result.rawError) {
    return NextResponse.json(
      { error: `YouTube API error: ${result.rawError}` },
      { status: result.status }
    );
  }

  const items = result.items.slice(0, max);

  return NextResponse.json({ items });
}

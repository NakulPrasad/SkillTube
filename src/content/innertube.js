/**
 * SkillTube - InnerTube & Data Fetcher
 * Resilient, zero-API-key video retrieval directly from YouTube's internal engine.
 */

/**
 * Parses video renderers from raw YouTube search results or InitialData
 */
function extractVideosFromRenderer(contents) {
  const videos = [];

  function traverse(node) {
    if (!node || typeof node !== "object") return;

    if (node.videoRenderer) {
      const vr = node.videoRenderer;
      const videoId = vr.videoId;
      const title = vr.title?.runs?.[0]?.text || vr.title?.simpleText || "";
      const channelName = vr.ownerText?.runs?.[0]?.text || vr.longBylineText?.runs?.[0]?.text || "";
      const channelUrl = vr.ownerText?.runs?.[0]?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url || "";
      const viewCount = vr.viewCountText?.simpleText || vr.shortViewCountText?.simpleText || "";
      const publishedTime = vr.publishedTimeText?.simpleText || "";
      const lengthText = vr.lengthText?.simpleText || "";
      
      // Get highest quality thumbnail
      const thumbnails = vr.thumbnail?.thumbnails || [];
      const thumbnail = thumbnails[thumbnails.length - 1]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

      // Check if it's a playlist or mix
      if (videoId && title) {
        videos.push({
          id: videoId,
          title,
          channelName,
          channelUrl,
          viewCount,
          publishedTime,
          duration: lengthText,
          thumbnail,
          url: `https://www.youtube.com/watch?v=${videoId}`
        });
      }
      return;
    }

    if (node.playlistRenderer) {
      const pr = node.playlistRenderer;
      const playlistId = pr.playlistId;
      const title = pr.title?.simpleText || pr.title?.runs?.[0]?.text || "";
      const channelName = pr.longBylineText?.runs?.[0]?.text || "";
      const videoCount = pr.videoCount || `${pr.videoCountText?.runs?.[0]?.text || "Multi"} videos`;
      const thumbnails = pr.thumbnails?.[0]?.thumbnails || [];
      const thumbnail = thumbnails[thumbnails.length - 1]?.url || "";

      if (playlistId && title) {
        videos.push({
          id: playlistId,
          isPlaylist: true,
          title: `📚 [Playlist] ${title}`,
          channelName,
          viewCount: videoCount,
          publishedTime: "Full Course",
          duration: "Series",
          thumbnail,
          url: `https://www.youtube.com/playlist?list=${playlistId}`
        });
      }
      return;
    }

    for (const key of Object.keys(node)) {
      traverse(node[key]);
    }
  }

  traverse(contents);
  return videos;
}

/**
 * Fetches structured video results for a specific query without an API key
 */
export async function searchSkillVideos(query, options = {}) {
  try {
    let url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    
    // Duration filters: sp=EgIYAw%253D%253D (Long > 20 min), sp=EgIQAw%253D%253D (Playlists)
    if (options.filter === "long") {
      url += "&sp=EgIYAw%253D%253D";
    } else if (options.filter === "playlist") {
      url += "&sp=EgIQAw%253D%253D";
    }

    const response = await fetch(url, {
      headers: {
        "Accept-Language": "en-US,en;q=0.9"
      }
    });

    const html = await response.text();
    
    // Extract ytInitialData from the page response
    const match = html.match(/var ytInitialData\s*=\s*({.+?});<\/script>/s) || 
                  html.match(/window\["ytInitialData"\]\s*=\s*({.+?});<\/script>/s);

    if (match && match[1]) {
      const data = JSON.parse(match[1]);
      const videos = extractVideosFromRenderer(data);
      return videos.slice(0, options.limit || 12);
    }
  } catch (err) {
    console.warn("[SkillTube] InnerTube fetch error for query:", query, err);
  }

  return [];
}

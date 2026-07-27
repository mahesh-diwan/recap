# Task 5: Transcript API Route

**Status:** ✅ Complete  
**Commit:** fffeabb

## What was done

Created `app/api/transcript/route.ts` — POST endpoint that:

- Extracts YouTube video ID from URL/ID string
- Fetches oembed metadata (title) from YouTube
- Fetches timed transcript entries via `youtube-transcript`
- Formats transcript with `[MM:SS] text` timestamps
- Returns `{ videoId, title, thumbnail, transcript }`

## Files

- `app/api/transcript/route.ts` — new (83 lines)

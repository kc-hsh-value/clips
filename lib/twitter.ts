const TWITTER_API_BASE = 'https://api.twitterapi.io/twitter';

export function extractTweetId(url: string): string | null {
  // Handle x.com and twitter.com URLs
  // Examples:
  // https://twitter.com/user/status/1234567890
  // https://x.com/user/status/1234567890
  const regex = /(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

export function isValidTweetUrl(url: string): boolean {
  return extractTweetId(url) !== null;
}

interface TweetData {
  id: string;
  text: string;
  viewCount: number;
  likeCount: number;
  retweetCount: number;
  replyCount: number;
  createdAt: string;
  author: {
    id: string;
    userName: string;
    name: string;
  };
}

interface TwitterApiTweet {
  id: string;
  text: string;
  viewCount?: number;
  views?: number;
  likeCount?: number;
  likes?: number;
  retweetCount?: number;
  retweets?: number;
  replyCount?: number;
  replies?: number;
  createdAt?: string;
  created_at?: string;
  author?: {
    id: string;
    userName: string;
    name: string;
  };
}

interface TwitterApiResponse {
  tweets?: TwitterApiTweet[];
  data?: TwitterApiTweet[];
  status?: string;
  message?: string;
}

export async function fetchTweetData(tweetId: string): Promise<TweetData | null> {
  const apiKey = process.env.TWITTER_API_KEY;
  
  if (!apiKey) {
    console.error('TWITTER_API_KEY not configured');
    return null;
  }

  try {
    // Correct endpoint: /tweets?tweet_ids=
    const url = `${TWITTER_API_BASE}/tweets?tweet_ids=${tweetId}`;
    console.log('Fetching tweet data from:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
      },
    });

    if (!response.ok) {
      console.error(`Twitter API error: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.error('Response body:', text);
      return null;
    }

    const result: TwitterApiResponse = await response.json();
    console.log('Twitter API response:', JSON.stringify(result, null, 2));
    
    // Handle response - could be in tweets or data array
    const tweets = result.tweets || result.data || [];
    const tweet = tweets[0];
    
    if (tweet) {
      return {
        id: tweet.id,
        text: tweet.text || '',
        viewCount: tweet.viewCount ?? tweet.views ?? 0,
        likeCount: tweet.likeCount ?? tweet.likes ?? 0,
        retweetCount: tweet.retweetCount ?? tweet.retweets ?? 0,
        replyCount: tweet.replyCount ?? tweet.replies ?? 0,
        createdAt: tweet.createdAt || tweet.created_at || '',
        author: tweet.author || { id: '', userName: '', name: '' },
      };
    }

    console.error('No tweet found in response');
    return null;
  } catch (error) {
    console.error('Error fetching tweet data:', error);
    return null;
  }
}

export async function fetchTweetViews(tweetId: string): Promise<number | null> {
  const data = await fetchTweetData(tweetId);
  return data?.viewCount ?? null;
}

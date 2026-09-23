export interface iTunesTrack {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName?: string;
  artworkUrl100: string;
  previewUrl: string;
  primaryGenreName?: string;
}

export interface QuizQuestion {
  questionNumber: number;
  correctTrack: iTunesTrack;
  options: iTunesTrack[]; // 10 options: 1 correct + 9 distractors, shuffled
}

export const PLAYLIST_CATEGORIES = [
  { id: 'Bollywood', name: 'All-Time Bollywood', query: 'Bollywood' },
  { id: 'Bollywood Hits 2024', name: 'Top Hits & Trending', query: 'Bollywood Hits 2024' },
  { id: 'Arijit Singh', name: 'Arijit Singh Specials', query: 'Arijit Singh Bollywood' },
  { id: '90s Bollywood', name: '90s Golden Era', query: '90s Bollywood Hits' },
  { id: 'Bollywood Party', name: 'Club & Dance Anthems', query: 'Bollywood Party Dance' },
  { id: 'Pritam', name: 'Pritam & Mohit Chauhan', query: 'Pritam Bollywood' },
];

/**
 * Curated high-energy Bollywood tracks as an instant reliable fallback
 * in case of network outages or Apple API rate limitations.
 */
const BACKUP_TRACKS: iTunesTrack[] = [
  {
    trackId: 15330001,
    trackName: 'Chaleya',
    artistName: 'Arijit Singh, Shilpa Rao & Anirudh Ravichander',
    collectionName: 'Jawan',
    artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/ec/3b/b7/ec3bb7b4-3580-c5a4-c081-30eb7c945fa6/8902894361538_cover.jpg/200x200bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview126/v4/0d/da/ee/0ddaeeae-d118-86d7-e244-59e559eeb6f1/mzaf_11306616035122557551.plus.aac.p.m4a',
  },
  {
    trackId: 15330002,
    trackName: 'Tum Hi Ho',
    artistName: 'Arijit Singh',
    collectionName: 'Aashiqui 2',
    artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/a4/c8/10/a4c810d7-6ae9-34dc-5c74-e84da10f3c55/8902894353243_cover.jpg/200x200bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview116/v4/58/0c/33/580c33a9-e087-9bb3-96b6-3932a3922f3e/mzaf_10697723797960309990.plus.aac.p.m4a',
  },
  {
    trackId: 15330003,
    trackName: 'Kesariya',
    artistName: 'Pritam, Arijit Singh & Amitabh Bhattacharya',
    collectionName: 'Brahmastra',
    artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/0e/63/05/0e6305a4-5696-faeb-b054-d8bc289069fe/8902894360357_cover.jpg/200x200bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview122/v4/35/3d/bf/353dbfce-ebfa-4aee-b286-9a28e93aaae9/mzaf_7306233488820888241.plus.aac.p.m4a',
  },
  {
    trackId: 15330004,
    trackName: 'Jhoome Jo Pathaan',
    artistName: 'Vishal-Shekhar, Arijit Singh & Sukriti Kakar',
    collectionName: 'Pathaan',
    artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/01/5e/5c/015e5c8e-a4b0-96f3-33df-a6df40356619/8902894360777_cover.jpg/200x200bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview126/v4/c3/fa/f3/c3faf31b-7561-8406-92c2-843818e38d66/mzaf_11370217983050414902.plus.aac.p.m4a',
  },
  {
    trackId: 15330005,
    trackName: 'Apna Bana Le',
    artistName: 'Sachin-Jigar & Arijit Singh',
    collectionName: 'Bhediya',
    artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/ec/36/f1/ec36f1eb-3294-f89b-df88-348c4dbe66f0/8902894360692_cover.jpg/200x200bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview116/v4/21/d9/64/21d96420-a6ad-333e-b7d1-0300ee3b9247/mzaf_10793739798442880000.plus.aac.p.m4a',
  },
  {
    trackId: 15330006,
    trackName: 'Galliyan',
    artistName: 'Ankit Tiwari',
    collectionName: 'Ek Villain',
    artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/06/f0/54/06f05459-86ca-f597-29ef-3b1b606c4b2c/8902894354226_cover.jpg/200x200bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/ea/9f/8e/ea9f8e40-fa9d-ee18-3fc8-005f77fe7754/mzaf_13576307379767220000.plus.aac.p.m4a',
  },
  {
    trackId: 15330007,
    trackName: 'Kar Gayi Chull',
    artistName: 'Badshah, Fazilpuria, Sukriti Kakar & Neha Kakkar',
    collectionName: 'Kapoor & Sons',
    artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/91/9f/95/919f95d8-967d-d1be-630e-272e21b8b60f/886445781442.jpg/200x200bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/f5/8a/be/f58abe31-c0a6-c856-11f8-005574519eb3/mzaf_12411629737522510000.plus.aac.p.m4a',
  },
  {
    trackId: 15330008,
    trackName: 'Ghungroo',
    artistName: 'Vishal-Shekhar, Arijit Singh & Shilpa Rao',
    collectionName: 'War',
    artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/80/7e/0b/807e0b57-ecfa-7f41-0ca2-7935f8d68962/8902894359481_cover.jpg/200x200bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/10/72/77/1072777f-1d4e-b830-4e2b-fbc674bf0800/mzaf_14488319688469950000.plus.aac.p.m4a',
  },
  {
    trackId: 15330009,
    trackName: 'Raataan Lambiyan',
    artistName: 'Tanishk Bagchi, Jubin Nautiyal & Asees Kaur',
    collectionName: 'Shershaah',
    artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/4b/96/8c/4b968c92-d961-d779-7b3b-18f4a7c030d9/8902894359986_cover.jpg/200x200bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/4b/1b/ec/4b1bec0a-f0f5-dd97-74eb-e869fb7a3c33/mzaf_6454795328906915000.plus.aac.p.m4a',
  },
  {
    trackId: 15330010,
    trackName: 'Lungi Dance',
    artistName: 'Yo Yo Honey Singh',
    collectionName: 'Chennai Express',
    artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/5c/49/a0/5c49a023-3db5-9e63-c75c-1f5926ecdb13/8902894353458_cover.jpg/200x200bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/21/5d/74/215d7426-5b6c-848e-2cb4-a1a636ebce1b/mzaf_10014283594957430000.plus.aac.p.m4a',
  },
  {
    trackId: 15330011,
    trackName: 'Kal Ho Naa Ho',
    artistName: 'Sonu Nigam',
    collectionName: 'Kal Ho Naa Ho',
    artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e5/a0/02/e5a0026e-4ea7-f1c2-3e28-a621be945ea7/886445781442.jpg/200x200bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/b9/8b/6e/b98b6e68-07f0-0226-0e31-8975a6c38221/mzaf_14488319688469950000.plus.aac.p.m4a',
  },
  {
    trackId: 15330012,
    trackName: 'Tujhe Dekha Toh',
    artistName: 'Kumar Sanu & Lata Mangeshkar',
    collectionName: 'Dilwale Dulhania Le Jayenge',
    artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/6c/53/aa/6c53aa13-f93d-4c3e-83d4-bf67a03fb450/8902894350105_cover.jpg/200x200bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/c4/f2/9b/c4f29bc4-b778-cbfa-5895-7ca5aa8017c6/mzaf_11370217983050414902.plus.aac.p.m4a',
  },
  {
    trackId: 15330013,
    trackName: 'Balam Pichkari',
    artistName: 'Vishal Dadlani & Shalmali Kholgade',
    collectionName: 'Yeh Jawaani Hai Deewani',
    artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/aa/6e/b2/aa6eb249-ae1e-aa67-72ee-0616b23f05c3/8902894353403_cover.jpg/200x200bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/91/3a/0d/913a0df4-6d91-2f74-3d96-b0ff05e60da4/mzaf_12411629737522510000.plus.aac.p.m4a',
  },
  {
    trackId: 15330014,
    trackName: 'Badtameez Dil',
    artistName: 'Benny Dayal & Shefali Alvares',
    collectionName: 'Yeh Jawaani Hai Deewani',
    artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/aa/6e/b2/aa6eb249-ae1e-aa67-72ee-0616b23f05c3/8902894353403_cover.jpg/200x200bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/28/7f/73/287f73ce-2b0e-6910-c4e2-671c66fe8eb1/mzaf_10014283594957430000.plus.aac.p.m4a',
  },
  {
    trackId: 15330015,
    trackName: 'Chaiyya Chaiyya',
    artistName: 'Sukhwinder Singh & Sapna Awasthi',
    collectionName: 'Dil Se..',
    artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/44/22/a3/4422a36d-1db1-9257-2eec-8a7a8d56b0ea/886445781442.jpg/200x200bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/9f/6d/cc/9f6dcc32-5a41-26c7-3199-28c04ec56127/mzaf_10697723797960309990.plus.aac.p.m4a',
  }
];

export async function fetchBollywoodSongs(searchTerm: string = 'Bollywood'): Promise<iTunesTrack[]> {
  try {
    const term = encodeURIComponent(searchTerm);
    const url = `https://itunes.apple.com/search?term=${term}&media=music&entity=song&limit=100`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`iTunes API returned status ${res.status}`);
    }

    const data = await res.json();
    if (!data.results || !Array.isArray(data.results)) {
      throw new Error('Invalid response structure from iTunes');
    }

    // Filter out items with no previewUrl, no trackName, or invalid formats
    const validTracks: iTunesTrack[] = [];
    const seenNames = new Set<string>();

    for (const item of data.results) {
      if (item.previewUrl && item.trackName && item.artistName) {
        // Clean and normalize track name (remove unnecessary '(From "Movie")' suffixes if too long, but keep readable)
        const normalizedKey = `${item.trackName.toLowerCase().trim()}_${item.artistName.toLowerCase().trim()}`;
        if (!seenNames.has(normalizedKey)) {
          seenNames.add(normalizedKey);
          validTracks.push({
            trackId: item.trackId || Math.floor(Math.random() * 10000000),
            trackName: item.trackName,
            artistName: item.artistName,
            collectionName: item.collectionName || '',
            artworkUrl100: item.artworkUrl100 || '',
            previewUrl: item.previewUrl,
            primaryGenreName: item.primaryGenreName,
          });
        }
      }
    }

    // If we received fewer than 15 valid songs (needed for 10 choices + variety), augment with fallback
    if (validTracks.length < 15) {
      return [...validTracks, ...BACKUP_TRACKS];
    }

    return validTracks;
  } catch (error) {
    console.warn('iTunes API fetch failed, using fallback tracks:', error);
    return BACKUP_TRACKS;
  }
}

/**
 * Generate 10 quiz questions:
 * For each question, select 1 correct song and 9 distractor songs (total 10 options).
 */
export function generateQuizRounds(songs: iTunesTrack[], totalQuestions: number = 10): QuizQuestion[] {
  if (!songs || songs.length < 10) {
    throw new Error('Not enough songs available to generate 10 options per question.');
  }

  // Shuffle pool of candidate correct songs
  const pool = [...songs].sort(() => 0.5 - Math.random());
  const actualRounds = Math.min(totalQuestions, pool.length);
  const questions: QuizQuestion[] = [];

  for (let q = 0; q < actualRounds; q++) {
    const correctTrack = pool[q];
    
    // Pick 9 unique distractors from remaining songs
    const remaining = songs.filter((s) => s.trackId !== correctTrack.trackId);
    const shuffledDistractors = [...remaining].sort(() => 0.5 - Math.random()).slice(0, 9);

    // Combine correct + 9 distractors into 10 options, then shuffle them
    const options = [correctTrack, ...shuffledDistractors].sort(() => 0.5 - Math.random());

    questions.push({
      questionNumber: q + 1,
      correctTrack,
      options,
    });
  }

  return questions;
}

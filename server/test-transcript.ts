import ytdl from '@distube/ytdl-core';

async function test() {
    try {
        const videoId = 'UF8uR6Z6KLc';
        const info = await ytdl.getInfo(videoId);
        const tracks = info.player_response?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

        if (tracks && tracks.length > 0) {
            const enTrack = tracks.find((t: any) => t.languageCode === 'en' || t.languageCode === 'en-US') || tracks[0];

            const baseUrl = enTrack.baseUrl + '&fmt=json3'; // Force JSON format!
            console.log('Fetching JSON captions from:', baseUrl);

            const res = await fetch(baseUrl);
            const data = await res.json();

            if (data && data.events) {
                const transcriptText = data.events
                    .filter((e: any) => e.segs)
                    .map((e: any) => e.segs.map((s: any) => s.utf8).join(''))
                    .join(' ')
                    .replace(/\n/g, ' ')
                    .replace(/ +/g, ' ');

                console.log('Success! Transcript length:', transcriptText.length);
                console.log('Snippet:', transcriptText.substring(0, 200));
            } else {
                console.log('Failed to parse JSON.');
            }
        } else {
            console.log('No caption tracks found on this video.');
        }
    } catch (e: any) {
        console.error('Error fetching ytdl info:', e.message);
    }
}
test();

1. Opus doesn't make videos. It writes a program that paints frames.
Opus 5.5 outputs text. It can't emit an MP4. Every video in this trend is code that something else turns into frames.
The trick is one function: seek(t). Give it a time, it paints the exact frame for that moment. No timers, no CSS transitions, no state carried between frames.
window.seek = async (t) => {
  // every style is computed from t, nothing else
  const u = P(t, 2.0, 0.5, E.inOut);         // eased progress of a move
  box(card, 70, lerp(620, 420, u), 940, 440); // position = pure function of t
  rise(title, t, 2.1);                         // masked word-by-word rise
  return true;
};
A headless browser calls it for every frame, takes a screenshot, and ffmpeg stitches them. Same input, same frames, every time. A fix is a one-line edit plus a re-render of the seconds that changed.
2. The flow that stopped the "mid" first renders
The one-liner gets you a clip. A flow gets you a film. Mine is always the same, in this order:
1. Inputs: brand, photos, song, format. If the brief lists them, ask for them.
2. Beat map: every scene starts on a beat, and the music drop lands on the key visual moment.
3. 4 stills, reviewed before anything else.
4. Full render, then a frame-by-frame check, then audio.
Step 3 saved me hours. On the Crave remake, the stills showed the message text going blurry during the send animation. Fixed in 2 minutes on a still. Found on a full render, that's a 10-minute re-render for nothing.
Here's the one I'm proudest of. A baguette, launched like a new Apple product. Same flow, white background, classical music, real crunch sounds.
https://x.com/RaphaelAubryy/status/2104178266990858739
3. Springs: why some motion looks expensive
Cheap motion goes from A to B on a fixed curve. Expensive motion has mass: it accelerates, overshoots a hair, settles.
The catch: it has to stay a pure function of time. So no physics simulation. A closed-form spring:
function step(tau, f = 3, z = 0.6) {         // damped spring, 0 -> 1
  if (tau <= 0) return 0;
  const w = 2 * Math.PI * f, wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * tau) * (Math.cos(wd * tau) + (z * w / wd) * Math.sin(wd * tau));
}

// a value that changes target several times = one spring per change, summed
function S(t, base, changes, f, z) {
  let v = base, prev = base;
  for (const [t0, to] of changes) { v += (to - prev) * step(t - t0, f, z); prev = to; }
  return v;
}
You can render frame 812 without simulating frames 0 to 811. That's what makes a 60 fps render deterministic.
4. Motion blur for free: render more frames than you keep
The render step that makes it look like a real film:
# 8 subframes per output frame, averaged by ffmpeg, then keep 1 in 8
ffmpeg -framerate 480 -i sub/s_%05d.jpg \
  -vf "tmix=frames=8,select='eq(mod(n\,8)\,7)',setpts=N/60/TB" \
  -r 60 -c:v libx264 -crf 14 -pix_fmt yuv420p out/video.mp4
The real cost: about 1 to 1.5 minutes of rendering per second of film at 8 subframes. My 15-second Crave remake is 886 frames, so 7,088 screenshots. Run it in the background and go do something else.
4 subframes is faster but leaves ghost copies on fast moves. I learned that on the first launch film.
5. Sound is where "AI video" starts feeling like a film
This is the part most posts skip, and it's where I spent the most time.
Never trust an automatic beat grid. On one of my tracks, the detected bar was 2 beats off. The drop landed on nothing. Now I find the drop by energy: measure the bass band bar by bar, find the jump, then zoom to 20 ms windows.
for t in np.arange(drop - 0.3, drop + 0.3, 0.02):
    seg = lowpassed[int(t * SR):int((t + 0.02) * SR)]
    print(f"{t:6.2f}", 10 * np.log10((seg ** 2).mean() + 1e-12))
# the jump is your drop. start the song at: drop_in_song - drop_in_film
Then every sound effect goes on its measured peak, not on the start of the file:
s = sfx / np.abs(sfx).max() * gain
start = int(t * SR) - int(np.abs(s).sum(1).argmax())   # the peak lands exactly on t
mix[start:start + len(s)] += s
Two-pass loudnorm to -14 LUFS at the end, because that's what X and LinkedIn normalize to anyway.
On the baguette film, the four crunches are real recordings cut from one "biting crunchy food" file, each placed on its peak. That's the detail people commented on.
6. Start from something real
Opus defaults to its own taste when you give it nothing. The fix is a reference.
My first viral one wasn't original at all. I remade the first 35 seconds of a music video as a paper-zine K-pop comeback, every lyric a cut-paper ransom note stamped on the beat. Built on an open-source starter kit, 0 video model, just JavaScript.
https://x.com/RaphaelAubryy/status/2103500173909356632
What worked: take the grammar of the reference (pacing, type, transitions), never its content.
7. Point it at your product
This is the part that pays.
I used the same pipeline for the launch video of my own SaaS, Howseen (howseen.ai). It tracks whether ChatGPT, Gemini and Perplexity recommend your brand, so the video had to explain that in 24 seconds: buyers ask AI, your prompts run on 5 engines, the answers come back, your score, your sources, the article that fixes the gap.
https://x.com/RaphaelAubryy/status/2104300246268571733
Two rules I'd never break again:
↳ Real data or a label. Anything illustrative on screen says "Example data". One fake number spotted in the replies kills the whole video.
↳ Real integrations only. My first draft showed 9 CMS logos as "native". Only 4 are. The final version says "Native: WordPress, Shopify, Ghost, BigCommerce. Anything else via webhook."
And the iteration was real: v1 was too static, v2 didn't explain the product, v3 added animated beams, v4 better prompts and colour logos, v5 a faster track and beat-synced camera punches. 5 versions, each one a few minutes of feedback.
8. Make it watch its own frames
Opus reads images. That's the single habit that separates the clips that go viral from the ones posted with "it's a bit mid".
Render a contact sheet (2 frames per second), a strip of 12 frames around
each fast move, and a phone-size sheet at 360 px wide. Look at them properly.
Be a harsh motion director, not a proud author.

Score 1-10: hook in the first 2s, readability at phone size, motion quality,
variety (something new every 2-4s), composition, data accuracy, sound sync.
List the 3 biggest problems with timestamps. Fix them. Re-render only the
affected seconds. Repeat until every score is 8+.
Things it caught for me: letters overlapping in an intro, a headline clipped by a blob, question chips stacked on top of each other, text blurring during a handoff, a flood so fast it read as a flash.


references:

https://github.com/echris6/motion-video-kit
https://github.com/howseen-ai/claude-motion-design
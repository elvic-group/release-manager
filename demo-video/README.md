# Music Release Manager demo video

The source for the public 90-second product walkthrough used in the ChatGPT app review.

## Render

```console
npm install
npx remotion render MusicReleaseManagerDemo out/music-release-manager-demo.mp4 --codec=h264 --crf=25 --pixel-format=yuv420p
```

Publish the rendered MP4 as `chatgpt-app/public/music-release-manager-demo.mp4`. The public demo page is served from `/demo`.

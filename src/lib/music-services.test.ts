import { describe, expect, it } from "vitest";
import { MUSIC_SERVICES, musicService, playerSrc } from "./music-services";

describe("musicService", () => {
  it("offers the five players that can open inside the page", () => {
    expect(MUSIC_SERVICES.map((service) => service.name)).toEqual([
      "Spotify",
      "YouTube Music",
      "SoundCloud",
      "YouTube",
      "Apple Music",
    ]);
  });

  it("rejects a service that cannot be embedded", () => {
    expect(musicService("spotify")?.id).toBe("spotify");
    expect(musicService("gaana")).toBeNull();
    expect(musicService("")).toBeNull();
  });

  it("opens any Spotify song, album, or playlist in Spotify's player", () => {
    expect(playerSrc("spotify", "https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl")).toBe(
      "https://open.spotify.com/embed/track/11dFghVXANMlKmJXsNCbNl?utm_source=generator&theme=0",
    );
    expect(playerSrc("spotify", "https://open.spotify.com/intl-en/album/1")).toBe(
      "https://open.spotify.com/embed/album/1?utm_source=generator&theme=0",
    );
    expect(playerSrc("spotify", "not a link")).toBeNull();
  });
});

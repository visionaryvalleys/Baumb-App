import { describe, expect, it } from "vitest";
import { trackFromShare } from "./music";

describe("trackFromShare", () => {
  it("splits a shared song name into title and artist", () => {
    expect(trackFromShare({ text: "Tu Hai Kahan · AUR" })).toEqual({
      title: "Tu Hai Kahan",
      artist: "AUR",
      source: "Saved",
      sourceUrl: "",
    });
  });

  it("keeps an Instagram reel link as an Instagram track", () => {
    const track = trackFromShare({ text: "https://www.instagram.com/reel/ABC123/" });
    expect(track?.source).toBe("Instagram");
    expect(track?.sourceUrl).toContain("instagram.com/reel/ABC123");
    expect(track?.title).toBe("Instagram reel");
  });

  it("reads a song title that arrives beside a reel link", () => {
    const track = trackFromShare({
      title: "Night Drive - Kayan",
      text: "https://www.instagram.com/reel/ZZ/",
    });
    expect(track).toMatchObject({ title: "Night Drive", artist: "Kayan", source: "Instagram" });
  });
});

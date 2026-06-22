import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';

let generateShareCard, shareRide;
const mockCtx = {
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  stroke: jest.fn(),
  arc: jest.fn(),
  fill: jest.fn(),
  fillRect: jest.fn(),
  fillText: jest.fn(),
  createLinearGradient: jest.fn(() => ({ addColorStop: jest.fn() })),
};

beforeAll(async () => {
  HTMLCanvasElement.prototype.getContext = jest.fn(() => mockCtx);
  HTMLCanvasElement.prototype.toBlob = jest.fn((cb) => cb(new Blob(['fake'], { type: 'image/png' })));

  const mod = await import('./share.js');
  generateShareCard = mod.generateShareCard;
  shareRide = mod.shareRide;
});

beforeEach(() => {
  jest.clearAllMocks();
  HTMLCanvasElement.prototype.getContext = jest.fn(() => mockCtx);
  HTMLCanvasElement.prototype.toBlob = jest.fn((cb) => cb(new Blob(['fake'], { type: 'image/png' })));
});

describe('generateShareCard', () => {
  it('returns a Blob when canvas is available', async () => {
    const blob = await generateShareCard({
      points: [
        { lat: 51.5, lng: -0.1 },
        { lat: 51.51, lng: -0.12 },
        { lat: 51.52, lng: -0.13 },
      ],
      distance: 12.34,
      movingTime: 1800,
      avgSpeed: 24.6,
      date: '2026-06-22',
      rideName: 'Morning Ride',
    });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/png');
    expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalledWith('2d');
  });

  it('handles single point gracefully', async () => {
    const blob = await generateShareCard({
      points: [{ lat: 51.5, lng: -0.1 }],
      distance: 0,
      movingTime: 0,
      avgSpeed: 0,
    });
    expect(blob).toBeInstanceOf(Blob);
  });

  it('handles empty points array', async () => {
    const blob = await generateShareCard({
      points: [],
      distance: 5.2,
      movingTime: 600,
      avgSpeed: 30.1,
    });
    expect(blob).toBeInstanceOf(Blob);
  });

  it('handles missing optional fields', async () => {
    const blob = await generateShareCard({ points: [] });
    expect(blob).toBeInstanceOf(Blob);
  });

  it('rejects when canvas is not supported', async () => {
    HTMLCanvasElement.prototype.getContext = jest.fn(() => null);
    await expect(generateShareCard({ points: [] })).rejects.toThrow('not supported');
  });
});

describe('shareRide', () => {
  beforeEach(() => {
    delete navigator.share;
    delete navigator.canShare;
    delete navigator.clipboard;
  });

  it('calls navigator.share with file when files supported', async () => {
    const shareMock = jest.fn().mockResolvedValue();
    navigator.share = shareMock;
    navigator.canShare = jest.fn(() => true);

    await shareRide({
      points: [{ lat: 51.5, lng: -0.1 }],
      distance: 12.34,
      movingTime: 1800,
      avgSpeed: 24.6,
      date: '2026-06-22',
      rideName: 'Morning Ride',
      rideId: 42,
    });

    expect(shareMock).toHaveBeenCalled();
    const args = shareMock.mock.calls[0][0];
    expect(args.title).toBe('CyclePlay Ride');
    expect(args.files).toBeDefined();
    expect(args.files[0]).toBeInstanceOf(File);
    expect(args.files[0].name).toBe('ride-share.png');
    expect(args.url).toContain('#/ride/42');
  });

  it('calls navigator.share without file when canShare returns false', async () => {
    const shareMock = jest.fn().mockResolvedValue();
    navigator.share = shareMock;
    navigator.canShare = jest.fn(() => false);

    await shareRide({ points: [], distance: 5, rideId: 3 });

    expect(shareMock).toHaveBeenCalled();
    expect(shareMock.mock.calls[0][0].files).toBeUndefined();
  });

  it('calls navigator.share without file when canShare is not available', async () => {
    const shareMock = jest.fn().mockResolvedValue();
    navigator.share = shareMock;

    await shareRide({ points: [], distance: 5, rideId: 3 });

    expect(shareMock).toHaveBeenCalled();
    expect(shareMock.mock.calls[0][0].files).toBeUndefined();
  });

  it('falls back to clipboard when navigator.share is unavailable', async () => {
    const writeTextMock = jest.fn().mockResolvedValue();
    navigator.clipboard = { writeText: writeTextMock };
    window.showAlert = jest.fn();

    await shareRide({ points: [], distance: 5, rideId: 7 });

    expect(writeTextMock).toHaveBeenCalled();
    expect(window.showAlert).toHaveBeenCalledWith('Copied!', expect.any(String), '📋');
  });

  it('builds correct URL with ride ID', async () => {
    const shareMock = jest.fn().mockResolvedValue();
    navigator.share = shareMock;

    await shareRide({ points: [], distance: 10, rideId: 99 });

    const url = shareMock.mock.calls[0][0].url;
    expect(url).toMatch(/\/#\/ride\/99$/);
  });

  it('builds correct share text with distance', async () => {
    const shareMock = jest.fn().mockResolvedValue();
    navigator.share = shareMock;

    await shareRide({ points: [], distance: 25.7, rideId: 5 });

    expect(shareMock.mock.calls[0][0].text).toContain('25.70 km');
  });
});

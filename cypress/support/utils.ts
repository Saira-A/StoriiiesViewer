import OpenSeadragon from "openseadragon";

export function getExpectedCentre(region: string) {
  const [x, y, width, height] = region.split(",").map(Number);
  return new OpenSeadragon.Point(x + width / 2, y + height / 2);
}

export function getActualCentre(viewer: OpenSeadragon.Viewer) {
  return viewer.viewport.viewportToImageCoordinates(
    viewer.viewport.getCenter(),
  );
}

export function assertWithinAcceptableRange(
  expected: number,
  actual: number,
  acceptableRange = 0.0000001,
) {
  expect(expected).to.be.within(
    actual - acceptableRange,
    actual + acceptableRange,
  );
}

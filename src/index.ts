import {
  loadManifest,
  Manifest,
  Canvas,
  AnnotationPage,
  Annotation,
} from "manifesto.js";
import OpenSeadragon from "openseadragon";
interface IStoriiiesViewerConfig {
  container: Element | HTMLElement | string | null;
  manifestUrl: string;
}

type ControlButtons = {
  prev: HTMLButtonElement;
  next: HTMLButtonElement;
};

type RawAnnotationPage = {
  id: string;
  type: string;
  items: Array<RawAnnotation>;
};

type RawAnnotation = {
  id: string;
  type: string;
  motivation: string;
  body: RawAnnotationBody;
  target: string;
};

type RawAnnotationBody = {
  type: string;
  value: string;
  language: string;
  format: string;
};

export default class StoriiiesViewer {
  private containerElement: HTMLElement | null;
  private manifestUrl: string;
  private _activeAnnotationIndex: number = -1;
  private _activeCanvasIndex: number = 0;
  public manifest!: Manifest;
  public label: string = "";
  public canvases!: Canvas[];
  public annotationPages: AnnotationPage[] = [];
  public activeCanvasAnnotations: Array<Annotation> = [];
  public instanceId: number;
  public viewer!: OpenSeadragon.Viewer;
  public infoAreaElement!: HTMLElement;
  public infoTextElement!: HTMLElement;
  public controlButtonElements!: ControlButtons;

  constructor(config: IStoriiiesViewerConfig) {
    this.instanceId = document.querySelectorAll(".storiiies-viewer").length;

    // Normalise the config container
    if (typeof config.container === "string") {
      this.containerElement = document.querySelector(config.container);
    } else {
      // Minor wrinkle around if the container is an Element or HTMLElement
      // It should be safe to cast it to HTMLElement
      this.containerElement = config.container as HTMLElement;
    }

    this.manifestUrl = config.manifestUrl;

    if (!this.containerElement || !this.manifestUrl) {
      throw new Error("Missing required config");
    }

    this.containerElement?.classList.add("storiiies-viewer");

    this.initManifest().then(() => {
      this.initViewer();
      this.insertInfoAndControls();
    });
  }

  /**
   * Load the manifest and extract the label, canvases and annotation pages
   */
  private async initManifest() {
    const rawManifest = await loadManifest(this.manifestUrl);
    this.manifest = new Manifest(rawManifest);

    this.label = this.manifest.getLabel().getValue() || "";

    // In lieu of a label, set the active annotation to 0 to show the first annotation
    if (!this.label) {
      this.activeAnnotationIndex = 0;
    }

    this.canvases = this.manifest.getSequenceByIndex(0).getCanvases();
    this.annotationPages = this.getAnnotationPages();
    this.activeCanvasAnnotations = this.getActiveCanvasAnnotations();
  }

  /**
   * Initialize the viewer
   */
  private initViewer() {
    this.viewer = OpenSeadragon({
      element: this.containerElement ?? undefined,
      tileSources: [this.canvases[this._activeCanvasIndex].imageServiceIds[0]],
      crossOriginPolicy: "Anonymous",
      showSequenceControl: false,
      showHomeControl: false,
      showZoomControl: false,
      showFullPageControl: false,
      visibilityRatio: 0.3,
    });
    this.viewer.canvas.ariaLabel = "Storiiies viewer";
    this.viewer.canvas.role = "application";
    this.viewer.element.insertAdjacentHTML(
      "afterbegin",
      `<p class="storiiies-viewer__description" id="storiiies-viewer-${this.instanceId}-description">Drag with your mouse or the arrow keys, and zoom with scroll or <kbd aria-label="plus">+</kbd> and <kbd aria-label="minus">-</kbd></p>`,
    );
    this.viewer.canvas.setAttribute(
      "aria-describedby",
      `storiiies-viewer-${this.instanceId}-description`,
    );
  }

  private updateViewer() {
    if (this._activeAnnotationIndex === -1) {
      this.viewer.viewport.goHome();
      return;
    }

    const target =
      this.getActiveCanvasAnnotations()[
        this._activeAnnotationIndex
      ].getTarget() || "";
    const region = this.getRegion(target);

    if (region) {
      this.viewer.viewport.fitBoundsWithConstraints(region);
    } else {
      this.viewer.viewport.goHome();
    }
  }

  /**
   * Set the active annotation index and perform any necessary updates
   */
  set activeAnnotationIndex(index: number) {
    // Lower bound can only be -1 if there is a label
    const lowerBound = this.label ? -1 : 0;
    const upperBound = this.activeCanvasAnnotations.length - 1;

    // Ignore out of bounds values
    if (index < lowerBound || index > upperBound) return;

    this._activeAnnotationIndex = index;

    // Reset button states
    this.controlButtonElements.prev.disabled = false;
    this.controlButtonElements.next.disabled = false;

    // Disable buttons
    switch (index) {
      case lowerBound:
        this.controlButtonElements.prev.disabled = true;
        break;
      case upperBound:
        this.controlButtonElements.next.disabled = true;
        break;
    }

    // Info text to be label or annotation
    if (this.infoTextElement) {
      if (this._activeAnnotationIndex >= 0) {
        this.infoTextElement.innerText = this.activeCanvasAnnotations[index]
          .getBody()[0]
          .getProperty("value");
      } else {
        this.infoTextElement.innerText = this.label;
      }
    }

    this.updateViewer();
  }

  /**
   * Create area for label, annotations and controls
   */
  private insertInfoAndControls() {
    const infoAreaEl = document.createElement("div");
    const prevButtonEl = document.createElement("button");
    const infoTextEl = document.createElement("p");
    prevButtonEl.classList.add("storiiies-viewer__nav-button");
    prevButtonEl.innerText = "Previous";
    prevButtonEl.disabled = true;

    const nextButtonEl = prevButtonEl.cloneNode() as HTMLButtonElement;
    nextButtonEl.innerText = "Next";
    nextButtonEl.disabled = false;

    [prevButtonEl, nextButtonEl].forEach((button) => {
      button.addEventListener("click", (e) => {
        if ((e.target as HTMLButtonElement).innerText === "Previous") {
          this.activeAnnotationIndex = this._activeAnnotationIndex - 1;
        } else {
          this.activeAnnotationIndex = this._activeAnnotationIndex + 1;
        }
      });
    });

    infoTextEl.classList.add("storiiies-viewer__info-text");
    infoTextEl.innerText = this.label;
    infoAreaEl.insertAdjacentElement("beforeend", infoTextEl);

    infoAreaEl.append(prevButtonEl, nextButtonEl);

    this.containerElement?.insertAdjacentElement("beforeend", infoAreaEl);
    infoAreaEl.classList.add("storiiies-viewer__info-area");

    this.infoAreaElement = infoAreaEl;
    this.infoTextElement = infoTextEl;
    this.controlButtonElements = {
      prev: prevButtonEl,
      next: nextButtonEl,
    };
  }

  /**
   * Retrieves the annotationPages for the manifest
   * (Temporary solution)
   */
  public getAnnotationPages(): Array<AnnotationPage> {
    const annotationPages: Array<AnnotationPage> = [];

    if (this.canvases.length) {
      this.canvases.forEach((canvas) => {
        // "getProperty" ejects and results in raw JSON
        // We need to instantiate each level with the appropriate constructor
        const rawAnnotationPages: Array<RawAnnotationPage> =
          canvas.getProperty("annotations") || [];

        annotationPages.push(
          ...rawAnnotationPages.map((rawAnnotationPage) => {
            const rawAnnotations: Array<RawAnnotation> | undefined =
              rawAnnotationPage.items;

            return new AnnotationPage(
              {
                ...rawAnnotationPage,
                items: rawAnnotations.map((rawAnnotation) => {
                  return new Annotation(rawAnnotation, this.manifest.options);
                }),
                type: rawAnnotationPage.type,
              },
              this.manifest.options,
            );
          }),
        );
        return [];
      });
    }
    return annotationPages;
  }

  /**
   * Get the annotations for the current canvas
   */
  public getActiveCanvasAnnotations(): Array<Annotation> {
    return this.annotationPages[this._activeCanvasIndex].getItems();
  }

  /**
   * Get the region from the URL
   */
  public getRegion(url?: string): OpenSeadragon.Rect | null {
    const regex = /#xywh=(\d+),(\d+),(\d+),(\d+)/;
    const match = url?.match(regex);

    if (match) {
      const [, x, y, w, h] = match.map(Number);
      return this.viewer.viewport.imageToViewportRectangle(x, y, w, h);
    }

    return null;
  }
}

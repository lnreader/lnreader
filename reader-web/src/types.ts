// Typings for the parts of foliate-js (readest fork) the reader uses.

export interface FoliateSection {
  id: number;
  linear?: 'yes' | 'no';
  size: number;
  load(): string | Promise<string>;
  loadContent?(): string | Promise<string>;
  unload?(): void;
  createDocument?(): Promise<Document>;
}

export interface FoliateBook {
  sections: FoliateSection[];
  dir?: 'ltr' | 'rtl';
}

export type FoliateAnchor =
  | number
  | Range
  | Element
  | ((doc: Document) => number | Range | Element | null);

export interface RelocateDetail {
  reason: string;
  range: Range;
  index: number;
  fraction: number;
  /** Paginated: share of the section one spread shows. */
  size?: number;
}

export interface FoliateContents {
  index: number;
  doc: Document;
}

export interface FoliatePaginator extends HTMLElement {
  open(book: FoliateBook): void;
  goTo(target: { index: number; anchor?: FoliateAnchor }): Promise<void>;
  next(distance?: number): Promise<void>;
  prev(distance?: number): Promise<void>;
  scrollToAnchor(
    anchor: Range | Element | number,
    select?: boolean,
    smooth?: boolean,
  ): Promise<void>;
  setStyles(styles: string | [string, string]): void;
  getContents(): FoliateContents[];
  render(): void;
  destroy(): void;
  readonly primaryIndex: number;
  readonly atStart: boolean;
  readonly atEnd: boolean;
  readonly scrolled: boolean;
  readonly size: number;
  containerPosition: number;
  subpixelOffset: number;
  heads?: HTMLElement[] | null;
  feet?: HTMLElement[] | null;
  columnCount?: number;
}

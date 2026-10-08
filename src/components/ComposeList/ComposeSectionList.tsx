import { useMemo, type ReactElement, type ReactNode } from 'react';
import { ComposeList, type ComposeListProps } from './ComposeList';

export interface ComposeSection {
  data: readonly unknown[];
}

type ItemOf<S extends ComposeSection> = S['data'][number];

type Row<T, S> =
  | { kind: 'header'; section: S; index: number }
  | { kind: 'item'; item: T; section: S; index: number };

export interface ComposeSectionListProps<
  S extends ComposeSection,
  T = ItemOf<S>,
> extends Pick<
    ComposeListProps<T>,
    | 'contentPadding'
    | 'extraData'
    | 'onEndReached'
    | 'onRefresh'
    | 'refreshing'
    | 'estimatedItemSize'
  > {
  sections: readonly S[];
  keyExtractor: (item: T, index: number) => string;
  renderItem: (info: { item: T; section: S; index: number }) => ReactNode;
  renderSectionHeader?: (info: { section: S }) => ReactNode;
  ListHeaderComponent?: ReactElement | null;
  ListEmptyComponent?: ReactElement | null;
}

/**
 * `SectionList`'s shape over a `ComposeList`: headers become their own rows,
 * since each row is hosted in Compose on its own.
 */
export function ComposeSectionList<S extends ComposeSection>({
  sections,
  keyExtractor,
  renderItem,
  renderSectionHeader,
  ListHeaderComponent,
  ListEmptyComponent,
  ...listProps
}: ComposeSectionListProps<S>) {
  const rows = useMemo(() => {
    const result: Row<ItemOf<S>, S>[] = [];
    sections.forEach((section, sectionIndex) => {
      if (renderSectionHeader) {
        result.push({ kind: 'header', section, index: sectionIndex });
      }
      section.data.forEach((item, index) =>
        result.push({ kind: 'item', item, section, index }),
      );
    });
    return result;
  }, [renderSectionHeader, sections]);

  return (
    <ComposeList
      {...listProps}
      data={rows}
      keyExtractor={row =>
        row.kind === 'header'
          ? `section-${row.index}`
          : keyExtractor(row.item, row.index)
      }
      renderItem={row =>
        row.kind === 'header'
          ? renderSectionHeader?.({ section: row.section })
          : renderItem(row)
      }
      header={ListHeaderComponent}
      footer={rows.length ? null : ListEmptyComponent}
    />
  );
}

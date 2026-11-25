import { useEffect, useMemo, useState } from 'react';

import { db } from '@database/db';
import { getGroupedUpdateChaptersQuery } from '@database/queries/ChapterQueries';
import type { Update, UpdateOverview } from '@database/types';
import { showToast } from '@utils/showToast';

type UpdateChapter = Update & { updateDate: string };
type UpdateGroup = readonly [novelId: number, updateDate: string];

export const updateGroupKey = (novelId: number, date: string) =>
  `${novelId}:${date}`;

const EMPTY = new Map<string, Update[]>();

export const useGroupedUpdateChapters = (
  overview: UpdateOverview[],
  expanded: ReadonlySet<string>,
) => {
  // One subscription covers single-chapter and expanded groups, independent
  // of the search filter. Typing in search does not restart the query.
  const requested = useMemo(
    () =>
      overview.flatMap<UpdateGroup>(group =>
        group.updatesPerDay === 1 ||
        expanded.has(updateGroupKey(group.novelId, group.updateDate))
          ? [[group.novelId, group.updateDate]]
          : [],
      ),
    [expanded, overview],
  );
  const [details, setDetails] = useState(EMPTY);

  useEffect(() => {
    if (!requested.length) {
      return;
    }

    const query = getGroupedUpdateChaptersQuery(requested);
    const { sql, params } = query.toSQL();
    let active = true;
    let receivedChange = false;

    const publish = (chapters: UpdateChapter[]) => {
      const groups = new Map<string, Update[]>(
        requested.map(([id, date]) => [updateGroupKey(id, date), []]),
      );
      for (const chapter of chapters) {
        groups
          .get(updateGroupKey(chapter.novelId, chapter.updateDate))
          ?.push(chapter);
      }
      setDetails(groups);
    };

    const unsubscribe = db.reactiveExecute({
      query: sql,
      arguments: params as NonNullable<Parameters<typeof db.executeSync>[1]>,
      fireOn: [{ table: 'Chapter' }],
      callback: (result: { rows: UpdateChapter[] }) => {
        if (active) {
          receivedChange = true;
          publish(result.rows);
        }
      },
    });

    void query.all().then(
      chapters => {
        if (active && !receivedChange) {
          publish(chapters);
        }
      },
      error => {
        if (active && !receivedChange) {
          showToast(error instanceof Error ? error.message : String(error));
          publish([]);
        }
      },
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [requested]);

  return requested.length ? details : EMPTY;
};

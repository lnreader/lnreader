import { buildGenreTree } from '../utils';

const novel = (id: number, genres: string | null) => ({
  id,
  name: `n${id}`,
  path: '',
  cover: null,
  pluginId: '',
  genres,
  status: null,
});

describe('buildGenreTree', () => {
  it('displays the most common original spelling for merged standalone genres', () => {
    const tree = buildGenreTree([
      novel(1, 'sci-fi'),
      novel(2, 'Sci-Fi'),
      novel(3, 'Sci-Fi'),
      novel(4, 'SCIFI'),
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe('Sci-Fi');
    expect(tree[0].count).toBe(4);
    expect(tree.some(n => n.name === 'Scifi')).toBe(false);
  });

  it('displays taxonomy names raw while matching normalized', () => {
    const tree = buildGenreTree(
      [novel(1, 'scifi'), novel(2, 'urbanfantasy')],
      [{ parent: 'Sci-Fi', children: ['Urban Fantasy'] }],
    );

    const category = tree.find(n => n.name === 'Sci-Fi');
    expect(category).toBeDefined();
    expect(category!.isCategory).toBe(true);
    expect(category!.categoryTotal).toBe(2);
    expect(category!.children).toHaveLength(1);
    expect(category!.children![0].name).toBe('Urban Fantasy');
    expect(tree.some(n => n.name === 'Scifi')).toBe(false);
  });

  it('breaks spelling ties deterministically by first encounter', () => {
    const tree = buildGenreTree([novel(1, 'ACTION'), novel(2, 'Action')]);

    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe('ACTION');
    expect(tree[0].count).toBe(2);
  });

  it('bundles children under a category whose parent genre is absent', () => {
    const tree = buildGenreTree(
      [
        novel(1, 'Female Lead'),
        novel(2, 'Male Lead'),
        novel(3, 'Adventure'),
      ],
      [{ parent: 'Lead', children: ['Female Lead', 'Male Lead', 'Anti-Hero Lead'] }],
    );

    const category = tree.find(n => n.name === 'Lead');
    expect(category).toBeDefined();
    expect(category!.isCategory).toBe(true);
    expect(category!.categoryTotal).toBe(2);
    expect(category!.count).toBe(0);
    expect(category!.children).toHaveLength(2);
    expect(category!.children!.map(c => c.name).sort()).toEqual([
      'Female Lead',
      'Male Lead',
    ]);
    // children must not also appear as standalone rows
    expect(tree.some(n => n.name === 'Female Lead')).toBe(false);
    expect(tree.some(n => n.name === 'Male Lead')).toBe(false);
    // unrelated genres stay standalone
    expect(tree.some(n => n.name === 'Adventure')).toBe(true);
  });

  it('keeps the Unknown bucket and non-Latin genre spellings', () => {
    const tree = buildGenreTree([novel(1, ''), novel(2, '玄幻')]);

    const unknown = tree.find(n => n.name === 'Unknown');
    expect(unknown).toBeDefined();
    expect(unknown!.count).toBe(1);

    const cn = tree.find(n => n.name === '玄幻');
    expect(cn).toBeDefined();
    expect(cn!.count).toBe(1);
    expect(tree.some(n => n.name === '')).toBe(false);
  });
});

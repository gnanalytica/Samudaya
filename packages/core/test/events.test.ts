import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ACTIVITIES,
  FUND_RULES,
  FUND_RULE_LABEL,
  REQUIREMENT_KEYS,
  TASK_STATUS_DOT,
  budgetBar,
  budgetTotal,
  fundedPercent,
  normalizeStats,
  surplus,
  tasksForRequirements,
  volunteersStillNeeded,
} from '../src/events';

describe('fundedPercent', () => {
  it('reports progress towards the target', () => {
    expect(fundedPercent(132000, 150000)).toBe(88);
    expect(fundedPercent(0, 150000)).toBe(0);
  });

  it('clamps at 100 so a progress bar cannot overflow', () => {
    expect(fundedPercent(200000, 150000)).toBe(100);
  });

  it('does not divide by zero when no target was set', () => {
    expect(fundedPercent(5000, 0)).toBe(0);
  });
});

describe('budgetBar', () => {
  it('measures a line against its own plan, not against the biggest line', () => {
    expect(budgetBar(9_000, 8_400)).toMatchObject({ percent: 93, over: 0, unplanned: false });
    expect(budgetBar(2_000, 0)).toMatchObject({ percent: 0, over: 0 });
  });

  it('fills the bar and says by how much when a line goes past its plan', () => {
    expect(budgetBar(6_000, 6_500)).toMatchObject({ percent: 100, over: 500 });
  });

  it('marks spending with no line behind it as outside the budget', () => {
    expect(budgetBar(0, 9_200)).toMatchObject({ percent: 100, over: 0, unplanned: true });
    expect(budgetBar(0, 0)).toMatchObject({ percent: 0, unplanned: false });
  });
});

describe('budgetTotal', () => {
  const lines = [
    { planned: 18_000, spent: 16_300 },
    { planned: 9_000, spent: 8_400 },
    { planned: 6_000, spent: 6_500 },
    { planned: 2_000, spent: 0 },
  ];

  it('adds the plans and the spending into one bar', () => {
    expect(budgetTotal(lines)).toMatchObject({
      planned: 35_000,
      spent: 31_200,
      percent: 89,
      over: 0,
    });
  });

  it('lets an underspent line offset an overspent one, as the accounts do', () => {
    expect(budgetTotal(lines).over).toBe(0);
    expect(budgetTotal([...lines, { planned: 0, spent: 9_200 }]).over).toBe(5_400);
  });
});

describe('surplus', () => {
  it('is what is left after approved spending', () => {
    expect(surplus(148000, 121500)).toBe(26500);
  });

  it('goes negative when an event overspends, rather than hiding it', () => {
    expect(surplus(100000, 121500)).toBe(-21500);
  });
});

describe('volunteersStillNeeded', () => {
  it('counts down from the target', () => {
    expect(volunteersStillNeeded(8, 3)).toBe(5);
  });

  it('never goes below zero when more people turn up than were asked for', () => {
    expect(volunteersStillNeeded(3, 9)).toBe(0);
  });
});

describe('normalizeStats', () => {
  it('fills in zeroes so a screen never has to null-check a total', () => {
    const stats = normalizeStats(null);
    expect(stats.fundRaised).toBe(0);
    expect(stats.readiness).toBe(0);
    expect(stats.contributors).toBe(0);
  });

  it('coerces the numeric strings PostgREST returns for money columns', () => {
    const stats = normalizeStats({ fund_raised: '132000.00' as unknown as number });
    expect(stats.fundRaised).toBe(132000);
  });
});

describe('checklist seeding', () => {
  it('builds a starting checklist from the requirements that were ticked', () => {
    const tasks = tasksForRequirements({ food: true, sound: true });
    expect(tasks).toContain('Finalize food vendor');
    expect(tasks).toContain('Book sound system');
    expect(tasks).not.toContain('Book photographer');
  });

  it('produces nothing when nothing is required', () => {
    expect(tasksForRequirements({})).toEqual([]);
  });

  it('covers every requirement key with at least one task', () => {
    for (const key of REQUIREMENT_KEYS) {
      expect(tasksForRequirements({ [key]: true }).length).toBeGreaterThan(0);
    }
  });
});

describe('vocabulary', () => {
  it('labels every fund rule, since the choice is shown to residents', () => {
    for (const rule of FUND_RULES) {
      expect(FUND_RULE_LABEL[rule].length).toBeGreaterThan(5);
    }
  });

  it('has a distinct dot for every task status', () => {
    expect(new Set(Object.values(TASK_STATUS_DOT)).size).toBe(Object.keys(TASK_STATUS_DOT).length);
  });

  it('offers default activities with an emoji each', () => {
    for (const activity of DEFAULT_ACTIVITIES) {
      expect(activity.emoji.length).toBeGreaterThan(0);
    }
  });
});

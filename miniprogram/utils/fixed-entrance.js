const DEFAULT_DELAY = 260;

function scheduleVisible(page, options = {}) {
  const { flagName = 'showFixedEntrance', timerKey = '_fixedEntranceTimer', delay = DEFAULT_DELAY } = options;
  hideVisible(page, { flagName, timerKey });
  page[timerKey] = setTimeout(() => {
    page.setData({ [flagName]: true });
    page[timerKey] = null;
  }, delay);
}

function hideVisible(page, options = {}) {
  const { flagName = 'showFixedEntrance', timerKey = '_fixedEntranceTimer' } = options;
  if (page[timerKey]) {
    clearTimeout(page[timerKey]);
    page[timerKey] = null;
  }
  if (page.data && page.data[flagName]) {
    page.setData({ [flagName]: false });
  }
}

module.exports = {
  DEFAULT_DELAY,
  scheduleVisible,
  hideVisible
};
